# coding: utf-8
import json
import re

from dicttoxml import dicttoxml
from rest_framework import renderers
from rest_framework import status
from rest_framework.exceptions import ErrorDetail
from rest_framework_xml.renderers import XMLRenderer as DRFXMLRenderer

import formpack
from kobo.apps.reports.report_data import build_formpack
from kpi.constants import GEO_QUESTION_TYPES


class AssetJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'json'


class SSJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'ssjson'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        # this accessing of the model might be frowned upon, but I'd prefer to avoid
        # re-building the SS structure outside of the model for now.
        return json.dumps(renderer_context['view'].get_object().to_ss_structure())


class XMLRenderer(DRFXMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None, relationship=None):
        if hasattr(renderer_context.get("view"), "get_object"):
            obj = renderer_context.get("view").get_object()
            # If `relationship` is passed among arguments, retrieve `xml` from this relationship.
            # e.g. obj is `Asset`, relationship can be `snapshot`
            if relationship is not None and hasattr(obj, relationship):
                return getattr(obj, relationship).xml
            return obj.xml
        else:
            return super().render(data=data,
                                  accepted_media_type=accepted_media_type,
                                  renderer_context=renderer_context)


class XFormRenderer(XMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return super().render(data=data,
                              accepted_media_type=accepted_media_type,
                              renderer_context=renderer_context,
                              relationship="snapshot")


class SubmissionGeoJsonRenderer(renderers.BaseRenderer):
    media_type = 'application/json'
    format = 'geojson'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        view = renderer_context['view']
        # `AssetNestedObjectViewsetMixin` provides the asset
        asset = view.asset
        if renderer_context['response'].status_code != status.HTTP_200_OK:
            # We're ending up with stuff like `{u'detail': u'Not found.'}` in
            # `data`. Is this the best way to handle that?
            return None
        pack, submission_stream = build_formpack(asset, data)
        # Right now, we're more-or-less mirroring the JSON renderer. In the
        # future, we could expose more export options (e.g. label language)
        export = pack.export(
            versions=pack.versions.keys(),
            group_sep='/',
            lang=formpack.constants.UNSPECIFIED_TRANSLATION,
            hierarchy_in_labels=True,
        )
        geo_question_name = view.request.query_params.get('geo_question_name')
        if not geo_question_name:
            # No geo question specified; use the first one in the latest
            # version of the form
            latest_version = next(reversed(list(pack.versions.values())))
            first_section = next(iter(latest_version.sections.values()))
            geo_questions = (field for field in first_section.fields.values()
                             if field.data_type in GEO_QUESTION_TYPES)
            try:
                geo_question_name = next(geo_questions).name
            except StopIteration:
                # formpack will gracefully return an empty `features` array
                geo_question_name = None
        return ''.join(
            export.to_geojson(
                submission_stream,
                geo_question_name=geo_question_name,
            )
        )


class SubmissionXMLRenderer(DRFXMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):

        custom_root = 'root'

        def node_generator(name, closing=False):
            if closing:
                return f'</{name}>'

            return f'<{name}>'

        def cleanup_submission(submission):
            return re.sub(r'^<\?xml[^>]*>', '', submission)

        # data should be str, but in case it's a dict, return as XML.
        # e.g. It happens with 404
        if isinstance(data, dict):
            # Force cast `ErrorDetail` as `six.text_type` because `dicttoxml`
            # does not recognize this type and treat each character as xml node.
            for k, v in data.items():
                if isinstance(v, ErrorDetail):
                    data[k] = str(v)

            # Submissions are wrapped in `<item>` nodes.
            # kludgy fix to render list of submissions in XML
            results = data.pop('results')
            submissions_parent_node = 'results'

            xml_ = dicttoxml(data, attr_type=False, custom_root=custom_root)
            # Retrieve the beginning of the XML (without closing tag) in order
            # to concatenate `results` as XML nodes too.
            xml_2_str = xml_.decode().replace(f'</{custom_root}>', '')

            opening_results_node = node_generator(submissions_parent_node)
            closing_results_node = node_generator(submissions_parent_node,
                                                  closing=True)
            results_data_str = ''.join(map(cleanup_submission, results))
            closing_root_node = node_generator(custom_root, closing=True)

            xml_2_str += f'{opening_results_node}' \
                f'{results_data_str}' \
                f'{closing_results_node}' \
                f'{closing_root_node}'

            return xml_2_str.encode()  # Should return bytes

        if renderer_context.get('view').action == 'list':
            opening_node = node_generator(custom_root)
            closing_node = node_generator(custom_root, closing=True)
            data_str = ''.join(data)
            return f'{opening_node}{data_str}{closing_node}'
        else:
            return data


class XlsRenderer(renderers.BaseRenderer):
    media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    # Really, this should be `format = 'xlsx'`, but let's not make a breaking
    # change to the API just to use a newer Excel format. Instead, we'll rely
    # on `AssetViewSet.finalize_response()` to set the filename appropriately
    format = 'xls'

    versioned = True
    kobo_specific_types = False

    def render(self, data, media_type=None, renderer_context=None):
        asset = renderer_context['view'].get_object()
        return asset.to_xls_io(versioned=self.versioned,
                               kobo_specific_types=self.kobo_specific_types)
