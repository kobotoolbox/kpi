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
from django.db.models import Q

from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.models import Asset, AssetFile


class Command(BaseCommand):

    URL_MEDIA_CONTENT = (
        '{kc_url}/{username}/forms/{xform_id_string}/formid-media/{media_id}'
    )
    URL_MEDIA_DETAIL = '{kc_url}/api/v1/metadata/{metadata_id}?format=json'
    URL_MEDIA_LIST = (
        '{kc_url}/api/v1/metadata?data_type=media&xform={formid}&format=json'
    )

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

        stats = self._sync_media_files(**options)
        if not options['quiet']:
            sys.stdout.write(json.dumps(stats, indent=4) + '\n')
            sys.stdout.flush()

    def _get_asset_metadata(self, token: str, formid: int) -> Optional[dict]:
        url = self.URL_MEDIA_LIST.format(
            kc_url=settings.KOBOCAT_INTERNAL_URL,
            formid=formid,
        )
        response = self._make_authenticated_request(url, token)
        if response.status_code == status.HTTP_200_OK:
            return response.json()

    def _get_media_file_content(
        self,
        token: str,
        username: str,
        xform_id_string: str,
        media_id: str,
    ) -> bytes:
        url = self.URL_MEDIA_CONTENT.format(
            kc_url=settings.KOBOCAT_INTERNAL_URL,
            username=username,
            xform_id_string=xform_id_string,
            media_id=media_id,
        )
        response = self._make_authenticated_request(url, token)
        return response.content

    @staticmethod
    def _make_authenticated_request(
        url: str,
        token: str,
        method: str = 'GET',
        data: dict = {},
    ) -> requests.models.Response:
        return requests.request(
            method=method,
            url=url,
            headers={
                'Authorization': f'Token {token}',
            },
            data=data,
        )

    def _sync_media_files(
        self,
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
        assets_modified_count = 0
        for asset in assets.iterator(chunk_size=chunks):
            if not asset.has_deployment:
                continue

            asset_xform_id = asset.deployment.backend_response['formid']
            user = asset.owner
            token = Token.objects.get(user=user)
            sync_stats = {}

            # for logging stats
            if not quiet:
                kpi_before = asset.asset_files.filter(
                    file_type=AssetFile.FORM_MEDIA,
                    date_deleted__isnull=True,
                ).count()

            media_files = self._get_asset_metadata(token, formid=asset_xform_id)
            if media_files is None:
                continue

            synced_files = []
            for media_file in media_files:
                media_filename = media_file['data_value']
                media_id = media_file['id']
                media_xform_id = media_file['xform']
                media_data_file = media_file['data_file']
                media_file_hash = media_file['file_hash']
                media_from_kpi = media_file['from_kpi']
                only_set_from_kpi = False

                sync_data = {
                    'data_value': media_filename,
                    'id': media_id,
                    'from_kpi_is_true': False,
                    'synced_file': False,
                    'renamed_existing_kpi_file': False,
                }

                # Already being handled by kpi
                if media_from_kpi:
                    continue

                # Ensure that we don't create duplicates of files or urls. We do
                # want to set `from_kpi` to `True` on the kc object if the same
                # file exists in both places
                asset_files = asset.asset_files.filter(date_deleted__isnull=True)
                q_filename_and_hash = Q(
                    metadata__filename=media_filename,
                    metadata__hash=media_file_hash,
                )
                q_filename_not_hash = Q(metadata__filename=media_filename) & ~Q(
                    metadata__hash=media_file_hash
                )
                q_url = Q(metadata__redirect_url=media_filename)
                if asset_files.filter(q_filename_and_hash | q_url).exists():
                    only_set_from_kpi = True

                # If there is the same filename on kc and kpi but different hashes
                # then rename the current kpi file and copy over the file from kc
                _af_q = asset_files.filter(q_filename_not_hash)
                if _af_q.exists():
                    _af = _af_q.get()
                    _af_filename = _af.metadata['filename']
                    _af.metadata['filename'] = f'copy-of-{_af_filename}'
                    _af.save()
                    sync_data.update({'renamed_existing_kpi_file': True})

                sync_data.update(
                    {
                        'from_kpi_is_true': self._update_asset_metadata(
                            token=token,
                            metadata_id=media_id,
                            data_value=media_filename,
                        )
                    }
                )

                if only_set_from_kpi:
                    if not quiet and verbosity == 3:
                        synced_files.append(sync_data)
                    continue

                if media_data_file is None:
                    # Handle linked media files
                    filename_from_url = media_filename.split('/')[-1]
                    af = asset.asset_files.create(
                        user=user,
                        file_type=AssetFile.FORM_MEDIA,
                        description='default',
                        metadata={
                            'redirect_url': media_filename,
                            'filename': filename_from_url,
                        },
                    )
                else:
                    media_content = self._get_media_file_content(
                        token=token,
                        username=user.username,
                        xform_id_string=asset.deployment.xform_id_string,
                        media_id=media_id,
                    )

                    af = asset.asset_files.create(
                        user=user,
                        content=ContentFile(media_content, name=media_filename),
                        file_type=AssetFile.FORM_MEDIA,
                        description='default',
                    )

                sync_data.update({'synced_file': True})

                if not quiet and verbosity == 3:
                    synced_files.append(sync_data)

            if not quiet:
                kpi_after = asset.asset_files.filter(
                    file_type=AssetFile.FORM_MEDIA,
                    date_deleted__isnull=True,
                ).count()
                sync_stats = {
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
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
            if synced_files:
                assets_modified_count += 1

        stats_out = {
            'assets_selected_count': assets_selected_count,
            'assets_modified_count': assets_modified_count,
        }
        if not quiet and sync_stats_all and verbosity > 1:
            stats_out['sync_stats'] = sync_stats_all

        return stats_out

    def _update_asset_metadata(
        self,
        token: str,
        metadata_id: int,
        data_value: str,
    ) -> bool:
        """
        Set `from_kpi` to `True` on kc metadata object
        """
        url = self.URL_MEDIA_DETAIL.format(
            kc_url=settings.KOBOCAT_INTERNAL_URL,
            metadata_id=metadata_id,
        )
        data = {
            'from_kpi': True,
            'data_value': data_value,
        }
        response = self._make_authenticated_request(
            url,
            token,
            method='PATCH',
            data=data,
        )
        return response.status_code == status.HTTP_200_OK
