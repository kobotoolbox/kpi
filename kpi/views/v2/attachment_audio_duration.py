from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.permissions import AttachmentAudioDurationPermission
from kpi.schema_extensions.v2.asset_attachments.serializers import (
    AssetAttachmentAudioDurationRequest,
    AssetAttachmentAudioDurationResponse,
)
from kpi.serializers.v2.attachment_audio_duration import (
    AttachmentAudioDurationRequestSerializer,
)
from kpi.utils.audio_duration import get_audio_duration
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Survey data'],
    parameters=[
        OpenApiParameter(
            name='uid_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'asset_attachments/audio_duration.md'),
        request={'application/json': AssetAttachmentAudioDurationRequest},
        responses={200: AssetAttachmentAudioDurationResponse},
    ),
)
class AttachmentAudioDurationViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.ViewSet
):
    """
    ViewSet for querying audio duration of attachments on a specific asset

    Available actions:
    - create  → POST /api/v2/assets/{uid_asset}/attachments/audio-duration/

    Documentation:
    - docs/api/v2/asset_attachments/audio_duration.md
    """

    permission_classes = [AttachmentAudioDurationPermission]
    http_method_names = ['post']

    def create(self, request, *args, **kwargs):
        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist()

        request_serializer = AttachmentAudioDurationRequestSerializer(
            data=request.data
        )
        request_serializer.is_valid(raise_exception=True)
        requested_uids = request_serializer.validated_data['attachment_uids']

        # Scope to this asset's xform only, no cross-asset leakage possible
        attachments = Attachment.objects.filter(
            uid__in=requested_uids,
            xform_id=self.asset.deployment.xform_id,
        )
        attachment_map = {a.uid: a for a in attachments}

        result_items = []
        total = 0
        for uid in requested_uids:
            attachment = attachment_map.get(uid)
            # Skip silently if UID not found or belongs to a different asset
            if attachment is None:
                continue

            duration = get_audio_duration(attachment)
            seconds = int(duration) if duration is not None else None
            result_items.append({'uid': uid, 'seconds': seconds})
            if seconds is not None:
                total += seconds

        return Response(
            {'attachments': result_items, 'total': total},
            status=status.HTTP_200_OK,
        )
