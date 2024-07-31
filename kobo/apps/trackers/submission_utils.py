import os
import uuid

from django.conf import settings
from django.utils import timezone
from model_bakery import baker

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatDailyXFormSubmissionCounter,
    KobocatXForm,
)
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
    for user in users:
        assets = assets + baker.make(
            Asset,
            content=content_source_asset,
            owner=user,
            asset_type='survey',
            name='test',
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
    return (os.path.getsize(
        settings.BASE_DIR + '/kpi/tests/audio_conversion_test_clip.3gp'
    ) + os.path.getsize(
        settings.BASE_DIR + '/kpi/tests/audio_conversion_test_image.jpg'
    )) * submissions


def update_xform_counters(
    asset: Asset, xform: KobocatXForm = None, submissions: int = 1
):
    """
    Create/update the daily submission counter and the shadow xform we use to query it
    """
    today = timezone.now()
    if xform:
        xform.attachment_storage_bytes += (
            expected_file_size(submissions)
        )
        xform.save()
    else:
        xform_xml = (
            f'<?xml version="1.0" encoding="utf-8"?>'
            f'<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:odk="http://www.opendatakit.org/xforms" xmlns:orx="http://openrosa.org/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
            f'<h:head>'
            f'   <h:title>XForm test</h:title>'
            f'   <model odk:xforms-version="1.0.0">'
            f'       <instance>'
            f'           <{asset.uid} id="{asset.uid}" />'
            f'       </instance>'
            f'   </model>'
            f'</h:head>'
            f'<h:body>'
            f'</h:body>'
            f'</h:html>'
        )

        xform = baker.make(
            'logger.XForm',
            attachment_storage_bytes=(
                expected_file_size(submissions)
            ),
            kpi_asset_uid=asset.uid,
            date_created=today,
            date_modified=today,
            user_id=asset.owner_id,
            xml=xform_xml,
            json={}
        )
        xform.save()

    counter = KobocatDailyXFormSubmissionCounter.objects.filter(
        date=today.date(),
        user_id=asset.owner.id,
    ).first()

    if counter:
        counter.counter += submissions
        counter.save()
    else:
        counter = (
            baker.make(
                'logger.DailyXFormSubmissionCounter',
                date=today.date(),
                counter=submissions,
                xform=xform,
                user_id=asset.owner_id,
            )
        )
        counter.save()


def add_mock_submissions(assets: list, submissions_per_asset: int = 1):
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
            asset_submissions.append(submission)

        asset.deployment.mock_submissions(asset_submissions, flush_db=False)
        all_submissions = all_submissions + asset_submissions
        update_xform_counters(asset, submissions=submissions_per_asset)

    return all_submissions
