# coding: utf-8
import json
import re
from collections.abc import Callable
from io import StringIO


from dict2xml import dict2xml
from django.utils.xmlutils import SimplerXMLGenerator
from rest_framework import renderers, status
from rest_framework.exceptions import ErrorDetail
from rest_framework_xml.renderers import XMLRenderer as DRFXMLRenderer

import formpack
from kobo.apps.reports.report_data import build_formpack
from kpi.constants import GEO_QUESTION_TYPES
from kpi.utils.xml import add_xml_declaration


class AssetJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'json'


class MediaFileRenderer(renderers.BaseRenderer):
    media_type = '*/*'
    format = None
    charset = None
    render_style = 'binary'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class MP3ConversionRenderer(MediaFileRenderer):

    media_type = 'audio/mpeg'
    format = 'mp3'


class OpenRosaRenderer(DRFXMLRenderer):

    media_type = 'text/xml'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        """
        Duplicate `rest_framework_xml.renderers.XMLRenderer.render()` to add
        the `xmlns` attribute to the root node
        """
        if not hasattr(self, 'xmlns'):
            raise NotImplemented('`xmlns` must be implemented!')

        if data is None:
            return ''

        stream = StringIO()

        xml = SimplerXMLGenerator(stream, self.charset)
        xml.startDocument()
        xml.startElement(
            self.root_tag_name,
            {'xmlns': f'http://openrosa.org/xforms/{self.xmlns}'},
        )

        self._to_xml(xml, data)

        xml.endElement(self.root_tag_name)
        xml.endDocument()
        return stream.getvalue()


class OpenRosaFormListRenderer(OpenRosaRenderer):

    xmlns = 'xformsList'
    item_tag_name = 'xform'
    root_tag_name = 'xforms'


class OpenRosaManifestRenderer(OpenRosaRenderer):

    xmlns = 'xformsManifest'
    item_tag_name = 'mediaFile'
    root_tag_name = 'manifest'


class SSJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'ssjson'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        # this accessing of the model might be frowned upon, but
        # I'd prefer to avoid re-building the SS structure outside of the
        # model for now.
        return json.dumps(
            renderer_context['view'].get_object().to_ss_structure()
        )


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


class DoNothingRenderer(renderers.BaseRenderer):
    """
    This class exists only to specify that a view provides a particular format;
    subclass it and define `media_type` and `format` as needed. All real work
    must be done inside the view.
    This works around the problem of some formats needing to return a response
    directly, e.g. for redirection, not just the _content_ to be placed inside
    a response.
    """
    def render(*args, **kwargs):
        pass


class SubmissionXLSXRenderer(DoNothingRenderer):
    media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'  # noqa
    format = 'xlsx'


class SubmissionCSVRenderer(DoNothingRenderer):
    media_type = 'text/csv'
    format = 'csv'


class SubmissionXMLRenderer(DRFXMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):

        # data should be str, but in case it's a dict, return as XML.
        # e.g. It happens with 404
        if isinstance(data, dict):
            # Force cast `ErrorDetail` as `str` because `dict2xml`
            # does not recognize this type and treat each character as xml node.
            for k, v in data.items():
                if isinstance(v, ErrorDetail):
                    data[k] = str(v)

            return add_xml_declaration(self._get_xml(data))

        if isinstance(data, list):
            opening_node = self._node_generator(self.root_tag_name)
            closing_node = self._node_generator(
                self.root_tag_name, closing=True
            )
            data_str = ''.join(data)
            data = f'{opening_node}{data_str}{closing_node}'

        return add_xml_declaration(data)

    @classmethod
    def _get_xml(cls, data):

        # Submissions are wrapped in `<item>` nodes.
        results = data.pop('results', False)
        if not results:
            return dict2xml(data, wrap=cls.root_tag_name, newlines=False)

        submissions_parent_node = 'results'

        xml_ = dict2xml(data, wrap=cls.root_tag_name, newlines=False)
        # Retrieve the beginning of the XML (without closing tag) in order
        # to concatenate `results` as XML nodes too.
        xml_2_str = xml_.replace(f'</{cls.root_tag_name}>', '')

        opening_results_node = cls._node_generator(submissions_parent_node)
        closing_results_node = cls._node_generator(submissions_parent_node,
                                                   closing=True)
        results_data_str = ''.join(map(cls.__cleanup_submission, results))
        closing_root_node = cls._node_generator(cls.root_tag_name, closing=True)

        xml_2_str += (
            f'{opening_results_node}'
            f'{results_data_str}'
            f'{closing_results_node}'
            f'{closing_root_node}'
        )

        return xml_2_str

    @staticmethod
    def _node_generator(name, closing=False):
        if closing:
            return f'</{name}>'

        return f'<{name}>'

    @staticmethod
    def __cleanup_submission(submission):
        return re.sub(r'^<\?xml[^>]*>', '', submission)


class XMLRenderer(DRFXMLRenderer):

    def render(
        self,
        data,
        accepted_media_type=None,
        renderer_context=None,
        relationship=None,
        relationship_args=None,
        relationship_kwargs=None,
    ):
        if hasattr(renderer_context.get('view'), 'get_object'):
            obj = renderer_context.get('view').get_object()
            # If `relationship` is passed among arguments, retrieve `xml`
            # from this relationship.
            # e.g. obj is `Asset`, relationship can be `snapshot`
            if relationship is not None and hasattr(obj, relationship):
                var_or_callable = getattr(obj, relationship)
                if isinstance(var_or_callable, Callable):
                    return var_or_callable(
                        *(relationship_args or tuple()),
                        **(relationship_kwargs or dict())
                    ).xml
                return var_or_callable.xml
            return add_xml_declaration(obj.xml)
        else:
            return super().render(
                data=data,
                accepted_media_type=accepted_media_type,
                renderer_context=renderer_context,
            )


class XFormRenderer(XMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return super().render(
            data=data,
            accepted_media_type=accepted_media_type,
            renderer_context=renderer_context,
            relationship='snapshot',
            relationship_kwargs={'regenerate': 'True'},
        )


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
        return asset.to_xlsx_io(
            versioned=False,
            kobo_specific_types=self.kobo_specific_types,
        )
