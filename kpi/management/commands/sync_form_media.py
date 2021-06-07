# coding: utf-8
import json
import requests
import sys
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.models import Asset, AssetFile


URL_MEDIA_LIST = '{kc_url}/api/v1/metadata?data_type=media&format=json'
URL_MEDIA_DETAIL = '{kc_url}/api/v1/metadata/{metadata_id}?format=json'
URL_MEDIA_CONTENT = '{kc_url}/{username}/forms/{xform_id_string}/formid-media/{media_id}'


def _make_authenticated_request(
    url: str,
    token: str,
    method: str = 'GET',
    data: dict = {},
):
    return requests.request(
        method=method,
        url=url,
        headers={
            'Authorization': f'Token {token}',
        },
        data=data,
    )


def _get_asset_metadata(token: str) -> Optional[dict]:
    url = URL_MEDIA_LIST.format(kc_url=settings.KOBOCAT_INTERNAL_URL)
    response = _make_authenticated_request(url, token)
    if response.status_code == status.HTTP_200_OK:
        return response.json()


def _get_media_file_content(
    token: str,
    username: str,
    xform_id_string: str,
    media_id: str,
) -> bytes:
    url = URL_MEDIA_CONTENT.format(
        kc_url=settings.KOBOCAT_INTERNAL_URL,
        username=username,
        xform_id_string=xform_id_string,
        media_id=media_id,
    )
    response = _make_authenticated_request(url, token)
    return response.content


def _update_asset_metadata(
    token: str,
    metadata_id: int,
    data_value: str,
) -> bool:
    '''
    Set `from_kpi` to `True` on kc metadata object
    '''
    url = URL_MEDIA_DETAIL.format(
        kc_url=settings.KOBOCAT_INTERNAL_URL,
        metadata_id=metadata_id,
    )
    data = {
        'from_kpi': True,
        'data_value': data_value,
    }
    response = _make_authenticated_request(
        url,
        token,
        method='PATCH',
        data=data,
    )
    return response.status_code == status.HTTP_200_OK


def _sync_media_files(
    asset_uid: Optional[str],
    username: Optional[str],
    verbosity: int,
    chunks: int,
    quiet: bool,
    *args,
    **kwargs,
) -> dict:

    assets = Asset.objects.filter(_deployment_data__isnull=False)
    if username is not None:
        assets = assets.filter(owner__username=username)
    if assets and asset_uid is not None:
        assets = assets.filter(uid=asset_uid)

    sync_stats_all = []
    assets_selected_count = 0
    for asset in assets.iterator(chunk_size=chunks):
        sync_stats = {}
        if not asset.has_deployment:
            continue
        asset_xform_id = asset.deployment.backend_response['formid']
        user = asset.owner
        token = Token.objects.get(user=user)

        # for logging stats
        if not quiet:
            kpi_before = AssetFile.objects.filter(
                asset=asset,
                file_type=AssetFile.FORM_MEDIA,
                date_deleted__isnull=True,
            ).count()

        media_files = _get_asset_metadata(token)
        if media_files is None:
            continue

        synced_files = []
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
                xform_id_string=asset.deployment.xform_id_string,
                media_id=media_id,
            )

            af = AssetFile.objects.create(
                asset=asset,
                user=user,
                content=ContentFile(media_content, name=media_filename),
                file_type=AssetFile.FORM_MEDIA,
                description='default',
            )

            from_kpi_is_true = _update_asset_metadata(
                token=token,
                metadata_id=media_id,
                data_value=media_filename,
            )

            if not quiet and verbosity == 3:
                synced_files.append(
                    {
                        'data_value': media_filename,
                        'id': media_id,
                        'from_kpi_is_true': from_kpi_is_true,
                    }
                )

        if not quiet:
            kpi_after = AssetFile.objects.filter(
                asset=asset,
                file_type=AssetFile.FORM_MEDIA,
                date_deleted__isnull=True,
            ).count()
            sync_stats = {
                'asset_uid': asset.uid,
                'xform_id_string': asset.deployment.xform_id_string,
                'xformid': asset_xform_id,
                'asset_owner__username': asset.owner.username,
                'kobocat_form_media_count': len(
                    [m for m in media_files if m['xform'] == asset_xform_id]
                ),
                'kpi_form_media_pre_sync_count': kpi_before,
                'kpi_form_media_post_sync_count': kpi_after,
                'kpi_form_media_count_difference': kpi_after - kpi_before,
            }
            if verbosity == 3:
                sync_stats['synced_files'] = synced_files
            if verbosity > 1:
                sync_stats_all.append(sync_stats)

        assets_selected_count += 1

    stats_out = {
        'assets_selected_count': assets_selected_count,
    }
    if not quiet and sync_stats_all and verbosity > 1:
        stats_out['sync_stats'] = sync_stats_all

    return stats_out


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            action='store',
            dest='asset_uid',
            default=None,
            help="Sync only a specific asset's form-media",
        )
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=None,
            help="Sync only a specific user's form-media for assets that they own",
        )
        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Update records by batch of `chunks`.",
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            dest='quiet',
            default=False,
            help='Do not output status messages',
        )

    def handle(self, *args, **options):
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )

        stats = _sync_media_files(**options)
        if not options['quiet']:
            sys.stdout.write(json.dumps(stats, indent=4))
            sys.stdout.flush()
