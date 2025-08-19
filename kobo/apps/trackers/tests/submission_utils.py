import os
import time
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.utils import timezone
from model_bakery import baker

from kpi.models import Asset
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


def create_mock_assets(users: list, assets_per_user: int = 1):
    content_source_asset = {
        'survey': [
            {
                'type': 'audio',
                'label': 'q1',
                'required': 'false',
                '$kuid': str(uuid.uuid4()),
            },
            {
                'type': 'file',
                'label': 'q2',
                'required': 'false',
                '$kuid': str(uuid.uuid4()),
            },
        ]
    }
    assets = []

    def _get_uid(count):
        uids = []
        for i in range(count):
            _, random = str(time.time()).split('.')
            uids.append(f'a{random}_{i}')
        return uids

    for idx, user in enumerate(users):
        real_owner = user.organization.owner_user_object
        assets = assets + baker.make(
            Asset,
            content=content_source_asset,
            owner=real_owner,
            asset_type='survey',
            name='test',
            uid=iter(_get_uid(assets_per_user)),
            _quantity=assets_per_user,
        )

    for asset in assets:
        asset.deploy(backend='mock', active=True)
        asset.deployment.set_namespace(ROUTER_URL_NAMESPACE)
        asset.save()  # might be redundant?

    return assets


def expected_file_size(submissions: int = 1):
    """
    Calculate the expected combined file size for the test audio clip and image
    """
    return (
        os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_clip.3gp'
        )
        + os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_image.jpg'
        )
    ) * submissions


def add_mock_submissions(
    assets: list, submissions_per_asset: int = 1, age_days: int = 0
):
    """
    Add one (default) or more submissions to an asset
    """

    all_submissions = []
    for asset in assets:
        asset_submissions = []

        for x in range(submissions_per_asset):
            submission = {
                '__version__': asset.latest_deployed_version.uid,
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_uuid': str(uuid.uuid4()),
                '_attachments': [
                    {
                        'id': 1,
                        'download_url': f'http://testserver/{asset.owner.username}/audio_conversion_test_clip.3gp',
                        'filename': f'{asset.owner.username}/audio_conversion_test_clip.3gp',
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'id': 2,
                        'download_url': f'http://testserver/{asset.owner.username}/audio_conversion_test_image.jpg',
                        'filename': f'{asset.owner.username}/audio_conversion_test_image.jpg',
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': asset.owner.username,
            }
            if age_days > 0:
                submission_time = timezone.now() - relativedelta(days=age_days)
                submission['_submission_time'] = submission_time.strftime(
                    '%Y-%m-%dT%H:%M:%S'
                )
            asset_submissions.append(submission)

        asset.deployment.mock_submissions(asset_submissions)
        all_submissions = all_submissions + asset_submissions

    return all_submissions
