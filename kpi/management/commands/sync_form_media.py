# coding: utf-8
import json
import requests
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import User, Permission
from django.core.files.base import ContentFile
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import BaseCommand

from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.deployment_backends.kc_access.shadow_models import ReadOnlyKobocatXForm
from kpi.models import Asset, AssetFile


URL_MEDIA_LIST = '{kc_url}/api/v1/metadata?data_type=media&format=json'
URL_MEDIA_CONTENT = '{kc_url}/{username}/forms/{asset_uid}/formid-media/{media_id}'


def _get_asset_metadata(token):
    url = URL_MEDIA_LIST.format(kc_url=settings.KOBOCAT_INTERNAL_URL)
    response = requests.get(
        url=url, headers={'Authorization': f'Token {token}'}
    )
    return response.json()


def _get_media_file_content(token, username, asset_uid, media_id):
    url = URL_MEDIA_CONTENT.format(
        kc_url=settings.KOBOCAT_INTERNAL_URL,
        username=username,
        asset_uid=asset_uid,
        media_id=media_id,
    )
    response = requests.get(
        url=url, headers={'Authorization': f'Token {token}'}
    )
    return response.content


def _sync_media_files(asset_uid: Optional[str]):
    if asset_uid is not None:
        assets = Asset.objects.filter(
            uid=asset_uid,
            _deployment_data__isnull=False,
        )
    else:
        assets = Asset.objects.filter(_deployment_data__isnull=False)

    successes = []
    failures = []
    sync_stats_all = []
    for asset in assets:
        sync_stats = {}
        if not asset.has_deployment:
            continue
        asset_xform_id = asset.deployment.backend_response['formid']
        user = asset.owner
        token = Token.objects.get(user=user)

        # for logging stats
        kpi_before = AssetFile.objects.filter(
            asset=asset,
            file_type=AssetFile.FORM_MEDIA,
            date_deleted__isnull=True,
        ).count()

        media_files = _get_asset_metadata(token)
        for media_file in media_files:
            media_filename = media_file['data_value']
            media_id = media_file['id']
            media_xform_id = media_file['xform']

            # Ensure that we send the form-media to correct asset and
            # don't create duplicates
            if (
                media_xform_id != asset_xform_id
                or AssetFile.objects.filter(
                    asset=asset,
                    date_deleted__isnull=True,
                    metadata__filename=media_filename,
                ).exists()
            ):
                continue

            media_content = _get_media_file_content(
                token=token,
                username=user.username,
                asset_uid=asset.uid,
                media_id=media_id,
            )

            af = AssetFile.objects.create(
                asset=asset,
                user=user,
                content=ContentFile(media_content, name=media_filename),
                file_type=AssetFile.FORM_MEDIA,
                description='default',
            )
            successes.append(af.uid)

        kpi_after = AssetFile.objects.filter(
            asset=asset,
            file_type=AssetFile.FORM_MEDIA,
            date_deleted__isnull=True,
        ).count()
        sync_stats = {
            'asset_uid': asset.uid,
            'kobocat': len(
                [m for m in media_files if m['xform'] == asset_xform_id]
            ),
            'kpi_before': kpi_before,
            'kpi_after': kpi_after,
            'difference': kpi_after - kpi_before,
        }
        sync_stats_all.append(sync_stats)

    return {
        'assets': assets.count(),
        'successes': len(successes),
        'failures': len(failures),
        'stats': sync_stats_all,
    }


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            action='store',
            dest='asset_uid',
            default=None,
            help="Sync only a specific asset's form-media"
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            dest='quiet',
            default=False,
            help='Do not output status messages'
        )

    def handle(self, *args, **options):
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )
        asset_uid = options.get('asset_uid')
        quiet = options.get('quiet')

        stats = _sync_media_files(asset_uid=asset_uid)

        if not quiet:
            print(json.dumps(stats, indent=2))
