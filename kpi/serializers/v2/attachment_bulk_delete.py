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
        attachment_count = deployment.delete_attachments(
            request.user, self.data['attachment_uids']
        )

        return {'message': f'{attachment_count} attachments deleted'}

    def _get_deployment(self, asset):
        """
        Returns the deployment for the asset specified by the request
        """
        if not asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                t('The specified asset has not been deployed')
            )

        return asset.deployment
