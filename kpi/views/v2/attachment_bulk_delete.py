import json

from constance import config
from django.db.models import F
from django.utils.translation import gettext as t
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.permissions import SubmissionPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AttachmentBulkDeleteViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.ViewSet
):

    @action(detail=False, methods=['DELETE'], permission_classes=[SubmissionPermission])
    def bulk(self, request, *args, **kwargs):
        """
        ## DELETE all attachments of an Asset

        <pre class="prettyprint">
        <b>DELETE</b>  /api/v2/assets/<code>{asset_uid}</code>/attachments/bulk/
        </pre>

        > Example
        >
        >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/\
        attachments/bulk/
        >
        > Payload to perform bulk actions
        >
        >       {
        >           "payload": {
        >               "confirm": true,
        >           }
        >       }
        """

        try:
            payload = json.loads(request.body)
        except (json.JSONDecodeError, AttributeError):
            raise serializers.ValidationError(t('Invalid JSON payload'))

        if not payload.get('payload', {}).get('confirm'):
            raise serializers.ValidationError(t('Confirmation is required'))
        else:

            deployment = self._get_deployment()

            attachments = (
                Attachment.objects.filter(xform_id=deployment.xform_id)
                .annotate(
                    attachment_basename=F('media_file_basename'),
                    attachment_uid=F('uid'),
                )
                .values('pk', 'attachment_basename', 'attachment_uid')
            )
            attachment_uids = [att['attachment_uid'] for att in attachments]

            AttachmentTrash.toggle_statuses(attachment_uids, active=False)
            move_to_trash(
                request_author=request.user,
                objects_list=attachments,
                grace_period=config.ATTACHMENT_TRASH_GRACE_PERIOD,
                trash_type='attachment',
            )

        return Response(
            {'message': 'Attachments deleted'},
            status=status.HTTP_202_ACCEPTED,
        )

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                t('The specified asset has not been deployed')
            )

        return self.asset.deployment
