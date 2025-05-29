import uuid

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.models import Asset


class AssetSubmissionTestMixin:
    """
    A mixin to create an asset and a submission with attachment
    """
    def _create_test_asset_and_submission(self, user=None):
        if not user:
            user = User.objects.create(username='someuser', password='password')

        asset = Asset.objects.create(
            asset_type='survey',
            content={
                'survey': [
                    {'type': 'audio', 'label': 'q1', 'name': 'q1'},
                ]
            },
            owner=user
        )
        asset.deploy(backend='mock', active=True)
        asset.save()

        instance_id = uuid.uuid4()
        submission = {
            'q1': 'audio_conversion_test_clip.3gp',
            '_uuid': str(instance_id),
            '_attachments': [
                {
                    'download_url': f'http://testserver/{user.username}/audio_conversion_test_clip.3gp',  # noqa: E501
                    'filename': f'{user.username}/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                },
            ],
            '_submitted_by': user.username,
        }
        asset.deployment.mock_submissions([submission])
        asset.deployment.xform.refresh_from_db()
        xform = asset.deployment.xform

        instance = Instance.objects.get(root_uuid=instance_id)
        attachment = xform.attachments.first()

        user_profile, _ = UserProfile.objects.get_or_create(user=user)
        return asset, xform, instance, user_profile, attachment
