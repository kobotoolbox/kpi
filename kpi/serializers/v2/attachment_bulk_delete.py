from constance import config
from django.db.models import F
from django.utils.translation import gettext as t
from rest_framework import serializers

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.exceptions import ObjectDeploymentDoesNotExist


class AttachmentBulkDeleteSerializer(serializers.Serializer):
    attachment_uids = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text=t('List of attachment UIDs to delete.'),
    )

    def save(self, request, asset):
        deployment = self._get_deployment(asset)
        attachment_uids_to_delete = deployment.delete_attachments(
            request.user, self.data['attachment_uids']
        )

        attachments = (
            Attachment.objects.filter(
                xform_id=deployment.xform_id, uid__in=attachment_uids_to_delete
            )
            .annotate(
                attachment_basename=F('media_file_basename'),
                attachment_uid=F('uid'),
            )
            .values('pk', 'attachment_basename', 'attachment_uid')
        )

        attachment_uids = [att['attachment_uid'] for att in attachments]
        count = len(attachment_uids)

        AttachmentTrash.toggle_statuses(attachment_uids, active=False)
        move_to_trash(
            request_author=request.user,
            objects_list=attachments,
            grace_period=config.ATTACHMENT_TRASH_GRACE_PERIOD,
            trash_type='attachment',
        )

        return {'message': f'{count} attachments deleted'}

    def _get_deployment(self, asset):
        """
        Returns the deployment for the asset specified by the request
        """
        if not asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                t('The specified asset has not been deployed')
            )

        return asset.deployment
