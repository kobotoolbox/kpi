from django.utils.translation import gettext as t
from rest_framework import serializers

from kpi.exceptions import ObjectDeploymentDoesNotExist


class AttachmentBulkDeleteSerializer(serializers.Serializer):
    submission_ids = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text=t('List of submission ids to delete.'),
    )

    def save(self, request, asset):
        deployment = self._get_deployment(asset)

        attachment_count = deployment.delete_attachments(
            request.user, self.data['submission_ids']
        )

        if attachment_count is None:
            raise serializers.ValidationError(
                t('The list of submission ids cannot be empty')
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
