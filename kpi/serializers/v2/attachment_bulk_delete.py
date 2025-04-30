from django.utils.translation import gettext as t
from rest_framework import serializers

from kpi.exceptions import AttachmentUidMismatchException, ObjectDeploymentDoesNotExist


class AttachmentBulkDeleteSerializer(serializers.Serializer):
    attachment_uids = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text=t('List of attachment UIDs to delete.'),
    )

    def save(self, request, asset):
        deployment = self._get_deployment(asset)
        try:
            attachment_count = deployment.delete_attachments(
                request.user, self.data['attachment_uids']
            )
        except AttachmentUidMismatchException:
            raise serializers.ValidationError(
                t('One or more of the provided attachment UIDs are invalid')
            )

        if attachment_count is None:
            raise serializers.ValidationError(
                t('The list of attachment UIDs cannot be empty')
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
