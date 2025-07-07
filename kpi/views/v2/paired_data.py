# coding: utf-8
from django.conf import settings
from django.core.files.base import ContentFile
from django.http import Http404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import renderers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin
from shortuuid import ShortUUID

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.constants import SUBMISSION_FORMAT_TYPE_XML
from kpi.models import Asset, AssetFile, PairedData
from kpi.permissions import AssetEditorPermission, XMLExternalDataPermission
from kpi.renderers import SubmissionXMLRenderer
from kpi.schema_extensions.v2.paired_data.serializers import PairedDataResponse
from kpi.serializers.v2.paired_data import PairedDataSerializer
from kpi.utils.hash import calculate_hash
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response, \
    open_api_201_created_response, open_api_204_empty_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.xml import add_xml_declaration, strip_nodes


@extend_schema(
    tags=['Paired Data'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'paired_data/create.md'),
        responses=open_api_201_created_response(
            PairedDataResponse
        )
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'paired_data/delete.md'),
        responses=open_api_204_empty_response()
    ),
    external=extend_schema(
        description=read_md('kpi', 'paired_data/external.md')
    ),
    list=extend_schema(
        description=read_md('kpi', 'paired_data/list.md'),
        responses=open_api_200_ok_response(
            PairedDataResponse
        )
    ),
    update=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'paired_data/retrieve.md'),
        responses=open_api_200_ok_response(
            PairedDataResponse
        )
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'paired_data/update.md'),
        responses=open_api_200_ok_response(
            PairedDataResponse
        )
    ),
)
class PairedDataViewset(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedModelViewSet
):
    """

    """

    parent_model = Asset
    renderer_classes = (
        renderers.JSONRenderer,
    )
    lookup_field = 'paired_data_uid'
    permission_classes = (AssetEditorPermission,)
    serializer_class = PairedDataSerializer
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [
        ('source_name', 'source.name'),
        ('object_id', 'asset.id'),
        'fields',
        ('source_uid', 'source.uid'),
        'asset.owner.username',
    ]

    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[XMLExternalDataPermission],
        renderer_classes=[SubmissionXMLRenderer],
        filter_backends=[],
    )
    def external(self, request, paired_data_uid, **kwargs):
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

        old_hash = None
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
            # When the asset file is new, we consider its content as expired to
            # force its creation below
            has_expired = True
        else:
            if not asset_file.content:
                # if `asset_file` exists but does not have any content, it means
                # `paired_data` has changed since last time this endpoint has been
                # called. E.g.: Project owner has changed the questions they want
                # to include in the `xml-external` file
                has_expired = True
            else:
                old_hash = asset_file.md5_hash
                timedelta = timezone.now() - asset_file.date_modified
                has_expired = (
                    timedelta.total_seconds() > settings.PAIRED_DATA_EXPIRATION
                )

        # ToDo evaluate adding headers for caching and a HTTP 304 status code
        if not has_expired:
            return Response(asset_file.content.file.read().decode())

        # If the content of `asset_file' has expired, let's regenerate the XML
        submissions = source_asset.deployment.get_submissions(
            self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML
        )
        parsed_submissions = []
        allowed_fields = paired_data.allowed_fields
        random_uuid = ShortUUID().random(24)

        for submission in submissions:
            # Use `rename_root_node_to='data'` to rename the root node of each
            # submission to `data` so that form authors do not have to rewrite
            # their `xml-external` formulas any time the asset UID changes,
            # e.g. when cloning a form or creating a project from a template.
            # Set `use_xpath=True` because `paired_data.fields` uses full group
            # hierarchies, not just question names.
            parsed_submissions.append(
                strip_nodes(
                    submission,
                    allowed_fields,
                    use_xpath=True,
                    rename_root_node_to='data',
                    bulk_action_cache_key=random_uuid,
                )
            )

        filename = paired_data.filename
        parsed_submissions_to_str = ''.join(parsed_submissions)
        root_tag_name = SubmissionXMLRenderer.root_tag_name
        xml_ = add_xml_declaration(
            f'<{root_tag_name}>'
            f'{parsed_submissions_to_str}'
            f'</{root_tag_name}>'
        )

        if not parsed_submissions:
            # We do not want to cache an empty file
            return Response(xml_)

        # We need to delete the current file (if it exists) when filename
        # has changed. Otherwise, it would leave an orphan file on storage
        if asset_file.pk and asset_file.content.name != filename:
            asset_file.content.delete()

        asset_file.content = ContentFile(xml_.encode(), name=filename)

        # `xml_` is already there in memory, let's use its content to get its
        # hash and store it within `asset_file` metadata
        asset_file.set_md5_hash(calculate_hash(xml_, prefix=True))
        asset_file.save()
        if old_hash != asset_file.md5_hash:
            # resync paired data to the deployment backend
            self.asset.deployment.sync_media_files(AssetFile.PAIRED_DATA)

        return Response(xml_)

    def get_object_override(self):
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


class OpenRosaDynamicDataAttachmentViewset(PairedDataViewset):
    """
    Only specific to OpenRosa manifest when projects are linked with DDA.
    Enforce permission and renderer classes at the class level instead to be
    sure they are taken into account while calling `viewset.as_view()`
    """

    permission_classes = [XMLExternalDataPermission]
    renderer_classes = [SubmissionXMLRenderer]
    filter_backends = []
