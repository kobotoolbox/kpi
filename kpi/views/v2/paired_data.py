# coding: utf-8
from django.conf import settings
from django.core.files.base import ContentFile
from django.http import Http404
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from rest_framework import renderers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import INSTANCE_FORMAT_TYPE_XML
from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.models import Asset, AssetFile, PairedData
from kpi.permissions import (
    AssetEditorPermission,
    XMLExternalDataPermission,
)
from kpi.serializers.v2.paired_data import PairedDataSerializer
from kpi.renderers import SubmissionXMLRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.xml import strip_nodes, add_xml_declaration


class PairedDataViewset(AssetNestedObjectViewsetMixin,
                        NestedViewSetMixin,
                        viewsets.ModelViewSet):
    """
    ## List of paired project endpoints

    ### Retrieve all paired projects

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/

    > Response
    >
    >       HTTP 200 OK
    >       {
    >           "count": 1,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >                   "fields": [],
    >                   "filename": "external-data.xml",
    >                   "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >               }
    >           ]
    >       }
    >

    This endpoint is paginated and accepts these parameters:

    - `offset`: The initial index from which to return the results
    - `limit`: Number of results to return per page

    ### Link a project

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/

    > **Payload**
    >
    >        {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "filename": "external-data.xml",
    >           "fields": []",
    >        }
    >
    >
    > Response
    >
    >       HTTP 201 Created
    >       {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "fields": [],
    >           "filename": "external-data.xml",
    >           "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >       }
    >

    * `fields`: Optional. List of questions whose responses will be retrieved
        from the source data. If missing or empty, all responses will be
        retrieved. Questions must be identified by full group path separated by
        slashes, e.g. `group/subgroup/question_name`.
    * `filename`: Must be unique among all asset files. Only accepts letters, numbers and '-'.

    ### Retrieve a project

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/{paired_data_uid}/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/
    >
    > Response
    >
    >       HTTP 200 Ok
    >       {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "fields": [],
    >           "filename": "external-data.xml",
    >           "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >       }
    >

    ### Update a project

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/{paired_data_uid}/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/
    >
    > **Payload**
    >
    >        {
    >           "filename": "data-external.xml",
    >           "fields": ['group/question_1']",
    >        }
    >

    _Notes: `source` cannot be changed_

    > Response
    >
    >       HTTP 200 Ok
    >       {
    >           "source": "https://[kpi]/api/v2/assets/aFDZxidYs5X5oJjm2Tmdf5/",
    >           "fields": ['group/question_1'],
    >           "filename": "data-external.xml",
    >           "url": "https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/"
    >       }
    >

    ### Unlink a project

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/paired-data/{paired_data_uid}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/paired-data/pdFQheFF4cWbtcinRUqc64q/
    >
    > Response
    >
    >       HTTP 204 No Content
    >
    >


    ### CURRENT ENDPOINT
    """

    parent_model = Asset
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
        SubmissionXMLRenderer,
    )
    lookup_field = 'paired_data_uid'
    permission_classes = (AssetEditorPermission,)
    serializer_class = PairedDataSerializer

    @action(detail=True,
            methods=['GET'],
            permission_classes=[XMLExternalDataPermission],
            renderer_classes=[SubmissionXMLRenderer],
            filter_backends=[],
            )
    def external(self, request, paired_data_uid, **kwargs):
        """
        Returns an XML which contains data submitted to paired asset
        Creates the endpoints
        - /api/v2/assets/<parent_lookup_asset>/paired-data/<paired_data_uid>/external/
        - /api/v2/assets/<parent_lookup_asset>/paired-data/<paired_data_uid>/external.xml/
        """
        paired_data = self.get_object()

        # Retrieve the source if it exists
        source_asset = paired_data.get_source()

        if not source_asset:
            # We can enter this condition when source data sharing has been
            # deactivated after it has been paired with current form.
            # We don't want to keep zombie files on storage.
            try:
                asset_file = self.asset.asset_files.get(uid=paired_data_uid)
            except AssetFile.DoesNotExist:
                pass
            else:
                asset_file.delete()

            raise Http404

        if not source_asset.has_deployment or not self.asset.has_deployment:
            raise Http404

        # Retrieve data from related asset file.
        # If data has already been fetched once, an `AssetFile` should exist.
        # Otherwise, we create one to store the generated XML.
        try:
            asset_file = self.asset.asset_files.get(uid=paired_data_uid)
        except AssetFile.DoesNotExist:
            asset_file = AssetFile(
                uid=paired_data_uid,
                asset=self.asset,
                file_type=AssetFile.PAIRED_DATA,
                user=self.asset.owner,
            )
            # When asset file is new, we consider its content as expired to
            # force its creation below
            has_expired = True
        else:
            timedelta = timezone.now() - asset_file.date_modified
            has_expired = (
                timedelta.total_seconds() > settings.PAIRED_DATA_EXPIRATION
            )

        if not has_expired:
            return Response(asset_file.content.file.read().decode())

        # If the content of `asset_file' has expired, let's regenerate the XML
        submissions = source_asset.deployment.get_submissions(
            self.asset.owner.pk,
            format_type=INSTANCE_FORMAT_TYPE_XML
        )
        parsed_submissions = []

        for submission in submissions:
            # `strip_nodes` expects field names,
            parsed_submissions.append(
                strip_nodes(submission, paired_data.fields, use_xpath=True)
            )
        filename = paired_data.filename
        parsed_submissions_to_str = ''.join(parsed_submissions).replace(
            source_asset.uid, 'data'
        )
        root_tag_name = SubmissionXMLRenderer.root_tag_name
        xml_ = add_xml_declaration(
            f'<{root_tag_name}>'
            f'{parsed_submissions_to_str}'
            f'</{root_tag_name}>'
        )
        # We need to delete the current file (if it exists) when filename
        # has changed. Otherwise, it would leave an orphan file on storage
        if asset_file.pk and asset_file.content.name != filename:
            asset_file.content.delete()

        asset_file.content = ContentFile(xml_.encode(), name=filename)
        # We don't need to regenerate a hash when asset file is created.
        # It also avoids synchronizing the file with the back end again.
        generate_hash = bool(asset_file.pk)
        asset_file.save()
        paired_data.save(generate_hash=generate_hash)

        return Response(xml_)

    def get_object(self):
        obj = self.get_queryset(as_list=False).get(
            self.kwargs[self.lookup_field]
        )
        if not obj:
            raise Http404

        # May raise a permission denied
        self.check_object_permissions(self.request, obj)

        return obj

    def get_queryset(self, as_list=True):
        queryset = PairedData.objects(self.asset)
        if as_list:
            return list(queryset.values())
        return queryset

    def get_serializer_context(self):
        context_ = super().get_serializer_context()
        context_['asset'] = self.asset

        # To avoid multiple calls to DB within the serializer on the
        # list endpoint, we retrieve all source names and cache them in a dict.
        # The serializer can access it through the context.
        source_uids = self.asset.paired_data.keys()
        source__names = {}
        records = Asset.objects.values('uid', 'name').filter(uid__in=source_uids)
        for record in records:
            source__names[record['uid']] = record['name']
        context_['source__names'] = source__names
        return context_
