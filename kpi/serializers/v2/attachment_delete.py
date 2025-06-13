from django.db.models import Q
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

        if has_attachment_uid and has_submission_root_uuids:
            raise serializers.ValidationError(
                {
                    'detail': t(
                        '`attachment_uid` and `submission_root_uuids` cannot be '
                        'used together'
                    ),
                }
            )

        if not (has_attachment_uid or has_submission_root_uuids):
            raise serializers.ValidationError(
                {
                    'detail': t(
                        '`attachment_uid` or `submission_root_uuids` must be '
                        'provided'
                    ),
                }
            )

        if has_submission_root_uuids and not data.get('submission_root_uuids'):
            raise serializers.ValidationError(
                {'submission_root_uuids': [t('List cannot be empty')]}
            )

        return data

    def save(self, request, asset):
        deployment = self._get_deployment(asset)

        if self.validated_data.get('attachment_uid'):
            attachment_uids = [self.validated_data['attachment_uid']]
            field = 'attachment_uid'
        else:
            uuids = self.validated_data['submission_root_uuids']
            attachments = Attachment.objects.filter(
                Q(xform_id=deployment.xform_id) & (
                    Q(instance__root_uuid__in=uuids) |
                    (Q(instance__uuid__in=uuids) & Q(instance__root_uuid__isnull=True))
                )
            )
            attachment_uids = list(attachments.values_list('uid', flat=True))
            field = 'submission_root_uuids'

        attachment_mismatch = False
        try:
            attachment_count = deployment.delete_attachments(
                request.user, attachment_uids
            )
        except AttachmentUidMismatchException:
            attachment_mismatch = True

        if attachment_mismatch or attachment_count is None:
            message = (
                t('Invalid attachment UID')
                if field == 'attachment_uid'
                else t('One or more of the root UUIDs are invalid')
            )
            raise serializers.ValidationError({field: [message]})

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
