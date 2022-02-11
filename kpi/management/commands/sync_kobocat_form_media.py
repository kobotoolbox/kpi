# coding: utf-8
import requests
import sys
import time
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
        self._sync_media_files(**options)

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

        assets = Asset.objects.filter(_deployment_data__isnull=False).only(
            'id',
            'uid',
            'owner',
            'parent_id',
            'name',
            '_deployment_data',
        )
        if username is not None:
            assets = assets.filter(owner__username=username)
        if assets and asset_uid is not None:
            assets = assets.filter(uid=asset_uid)

        for asset in assets.iterator(chunk_size=chunks):
            if not asset.has_deployment:
                continue

            t_start = time.time()
            asset_xform_id = asset.deployment.backend_response['formid']
            user = asset.owner
            token = Token.objects.get(user=user)
            sync_stats = {}

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

                # Already being handled by kpi
                if media_from_kpi:
                    continue

                # Ensure that we don't create duplicates of files or urls. We do
                # want to set `from_kpi` to `True` on the kc object if the same
                # file exists in both places
                asset_files = asset.asset_files.filter(
                    date_deleted__isnull=True
                )
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

                # set `from_kpi` to `True` on kc metadata object
                self._update_asset_metadata(
                    token=token,
                    metadata_id=media_id,
                    data_value=media_filename,
                )

                if only_set_from_kpi:
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

            t_end = time.time()
            if not quiet:
                sync_stats.update({
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                    'xform_id_string': asset.deployment.xform_id_string,
                    'xformid': asset_xform_id,
                    'asset_owner__username': asset.owner.username,
                    'sync_time': '{:.4f}'.format(t_end- t_start),
                })
                self._write_to_stdout(sync_stats)

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

    @staticmethod
    def _write_to_stdout(data):
        sys.stdout.write('-' * 50 + '\n')
        for k, v in data.items():
            sys.stdout.write(f'{k}: {str(v)}\n')
        sys.stdout.flush()
