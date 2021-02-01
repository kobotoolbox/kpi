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
    AssetNestedObjectPermission,
    PairedDataPermission,
)
from kpi.serializers.v2.paired_data import PairedDataSerializer
from kpi.renderers import SubmissionXMLRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.xml import strip_nodes


class PairedDataViewset(AssetNestedObjectViewsetMixin,
                        NestedViewSetMixin,
                        viewsets.ModelViewSet):
    """
    ### CURRENT ENDPOINT
    """

    parent_model = Asset
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
        SubmissionXMLRenderer,
    )
    lookup_field = 'paired_data_uid'
    permission_classes = (AssetNestedObjectPermission,)
    serializer_class = PairedDataSerializer

    @action(detail=True,
            methods=['GET'],
            permission_classes=[PairedDataPermission],
            renderer_classes=[SubmissionXMLRenderer],
            filter_backends=[],
            )
    def external(self, request, paired_data_uid, **kwargs):
        """
        Returns an XML which contains data submitted to paired asset
        """
        paired_data = self.get_object()

        # Retrieve the parent if it exists
        parent_asset = paired_data.get_parent()

        if not parent_asset:
            # ToDo Delete any related asset files
            raise Http404

        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                _('The specified asset has not been deployed')
            )

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

        # If the content of `asset_file' has expired, let's regenerate the XML
        if has_expired:
            submissions = parent_asset.deployment.get_submissions(
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
                parent_asset.uid, 'data'
            )
            root_tag_name = SubmissionXMLRenderer.root_tag_name
            xml_ = (
                f'<{root_tag_name}>'
                f'{parsed_submissions_to_str}'
                f'</{root_tag_name}>'
            )
            # We need to delete current file (if it exists) when filename has
            # changed. Otherwise it would leave an orphan file on storage
            if asset_file.pk and asset_file.content.name != filename:
                asset_file.content.delete()

            asset_file.content = ContentFile(xml_.encode(), name=filename)
            asset_file.save()
            paired_data.save(generate_hash=True)

        return Response(asset_file.content.file.read().decode())

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
        return context_
