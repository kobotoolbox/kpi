from django.utils.translation import gettext as t
from rest_framework import serializers

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.exceptions import AttachmentUidMismatchException, ObjectDeploymentDoesNotExist


class AttachmentDeleteSerializer(serializers.Serializer):
    attachment_uid = serializers.CharField(
        required=False,
        help_text=t('The attachment UID to delete'),
    )
    submission_root_uuids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text=t('List of submission root UUIDs to delete attachments from'),
    )

    def validate(self, data):
        has_attachment_uid = 'attachment_uid' in data
        has_submission_root_uuids = 'submission_root_uuids' in data

        if has_attachment_uid:
            attachment_uid = data['attachment_uid']
            if not isinstance(attachment_uid, str) or not attachment_uid:
                raise serializers.ValidationError(
                    {'attachment_uid': [t('Attachment UID must be a non-empty string')]}
                )
        elif has_submission_root_uuids:
            submission_root_uuids = data['submission_root_uuids']
            if not isinstance(submission_root_uuids, list):
                raise serializers.ValidationError(
                    {
                        'submission_root_uuids': [
                            t('Submission root UUIDs must be a list')
                        ]
                    }
                )
            if not submission_root_uuids:
                raise serializers.ValidationError(
                    {
                        'submission_root_uuids': [
                            t('Submission root UUIDs list cannot be empty')
                        ]
                    }
                )
            if not all(isinstance(uid, str) and uid for uid in submission_root_uuids):
                raise serializers.ValidationError(
                    {
                        'submission_root_uuids': [
                            t(
                                'All submission root UUIDs in the list must'
                                ' be non-empty strings'
                            )
                        ]
                    }
                )

        return data

    def save(self, request, asset):
        deployment = self._get_deployment(asset)

        if self.validated_data.get('attachment_uid'):
            attachment_uids = [self.validated_data['attachment_uid']]
        elif self.validated_data.get('submission_root_uuids'):
            attachments = Attachment.objects.filter(
                xform_id=deployment.xform_id,
                instance__uuid__in=self.validated_data['submission_root_uuids'],
            )
            attachment_uids = list(attachments.values_list('uid', flat=True))

        try:
            attachment_count = deployment.delete_attachments(
                request.user, attachment_uids
            )
        except AttachmentUidMismatchException:
            raise serializers.ValidationError(
                t('One or more of the attachment UIDs are invalid')
            )

        if attachment_count is None:
            raise serializers.ValidationError(t('No attachments found to delete'))

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
