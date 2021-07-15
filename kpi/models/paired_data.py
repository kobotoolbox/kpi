# coding: utf-8
import time
from typing import Union

from django.conf import settings
from rest_framework.reverse import reverse

from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import PairedDataException
from kpi.fields import KpiUidField
from kpi.interfaces import (
    OpenRosaManifestInterface,
    SyncBackendMediaInterface,
)
from kpi.models.asset_file import AssetFile
from kpi.utils.hash import calculate_hash


# FIXME: simplify this by making PairedData a real Django Model ^_^
class PairedData(OpenRosaManifestInterface,
                 SyncBackendMediaInterface):

    # `filename` implements:
    # - `OpenRosaManifestInterface.filename()`
    # - `SyncBackendMediaInterface.filename()`
    filename = None

    # FIXME after merging kpi#3268
    # `file_type` implements `SyncBackendMediaInterface.file_type()`
    # file_type = 'paired_data'

    def __init__(
        self,
        source_asset_or_uid: Union['kpi.models.Asset', str],
        filename: str,
        fields: list,
        asset: 'kpi.models.Asset',
        paired_data_uid: str = None,
    ):
        """
        Usually, this constructor should NOT be called directly except when
        creating a new paired data relationship. To retrieve existing pairings,
        use `PairedData.objects(asset)` instead.

        When the submission data from `source_asset_or_uid` is collected into
        a single XML file, it is attached to `asset` using `filename`, which
        the content of `asset` can then reference via `xml-external` (see
        https://xlsform.org/en/#external-xml-data). Specify a list of fields
        from the source asset to include using `fields`, or pass an empty list
        to include all fields.
        """
        try:
            self.source_uid = source_asset_or_uid.uid
        except AttributeError:
            self.source_uid = source_asset_or_uid
        self.asset = asset
        self.filename = filename
        self.fields = fields

        if not paired_data_uid:
            self.paired_data_uid = KpiUidField.generate_unique_id('pd')
        else:
            self.paired_data_uid = paired_data_uid

        self._asset_file = None

    def __str__(self):
        return f'<PairedData {self.paired_data_uid} ({self.filename})>'

    @property
    def allowed_fields(self):
        """
        Return only the fields (aka questions) that the destination project is
        allowed to pull data from.
        """
        source_asset = self.get_source()
        if not source_asset:
            raise PairedDataException('No source asset found.')

        source_fields = source_asset.data_sharing['fields']
        if not source_fields:
            return self.fields

        if not self.fields:
            return source_fields

        source_set = set(source_fields)
        self_set = set(self.fields)

        return list(self_set.intersection(source_set))

    @property
    def asset_file(self):
        if self._asset_file:
            return self._asset_file
        try:
            self._asset_file = self.asset.asset_files.get(
                uid=self.paired_data_uid
            )
            return self._asset_file
        except AssetFile.DoesNotExist:
            return None

    @property
    def backend_media_id(self):
        """
        Implements `SyncBackendMediaInterface.backend_media_id()`
        """
        from kpi.urls.router_api_v2 import URL_NAMESPACE  # avoid circular imports
        paired_data_url = reverse(
            f'{URL_NAMESPACE}:paired-data-external',
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'paired_data_uid': self.paired_data_uid,
                'format': 'xml'
            },
        )
        return f'{settings.KOBOFORM_URL}{paired_data_url}'

    def delete(self, **kwargs):
        """
        Implements `SyncBackendMediaInterface.delete()`
        """
        # Delete XML file
        if self.asset_file:
            self.asset_file.delete()
            self._asset_file = None

        # Update asset
        del self.asset.paired_data[self.source_uid]
        self.asset.save(
            update_fields=['paired_data'],
            adjust_content=False,
            create_version=False,
        )

    @property
    def deleted_at(self):
        """
        Implements `SyncBackendMediaInterface.deleted_at()`
        """
        return None

    @property
    def file_type(self):
        return 'paired_data'

    def get_download_url(self, request):
        """
        Implements `OpenRosaManifestInterface.get_download_url()`
        """
        return reverse('paired-data-external',
                       args=(self.asset.uid, self.paired_data_uid, 'xml'),
                       request=request)

    def get_source(self) -> Union['Asset', None]:

        # Avoid circular import
        Asset = self.asset.__class__  # noqa
        try:
            source_asset = Asset.objects.get(uid=self.source_uid)
        except Asset.DoesNotExist:
            return None

        # Data sharing must be enabled on the source
        if not source_asset.data_sharing.get('enabled'):
            return None

        # Validate `self.owner` is still allowed to see source data.
        # Their permissions could have been revoked since they linked their
        # form to source asset.
        required_perms = [
            PERM_PARTIAL_SUBMISSIONS,
            PERM_VIEW_SUBMISSIONS,
        ]
        if not source_asset.has_perms(
            self.asset.owner, required_perms, all_=False
        ):
            return None

        return source_asset

    @property
    def md5_hash(self):
        """
        Implements:
         - `OpenRosaManifestInterface.md5_hash()`
         - `SyncBackendMediaInterface.md5_hash()`
        """
        if self.asset_file:
            # If an AssetFile object is attached to this object, return its hash
            return self.asset_file.md5_hash
        else:
            # Fallback on this custom hash which does NOT represent the real
            # content but changes everytime to force its synchronization with
            # the deployment back end.
            # AssetFile object will be created on call to 'xml-external' endpoint
            return calculate_hash(
                f'{str(time.time())}.{self.backend_media_id}', prefix=True
            ) + '-time'

        return self.asset_file.md5_hash

    @property
    def is_remote_url(self):
        """
        Implements `SyncBackendMediaInterface.is_remote_url()`
        """
        return True

    @property
    def mimetype(self):
        """
        Implements `SyncBackendMediaInterface.mimetype()`
        """
        return 'application/xml'

    @classmethod
    def objects(cls, asset: 'kpi.models.Asset') -> 'kpi.models.PairedData':
        objects_ = {}
        for source_uid, values in asset.paired_data.items():
            objects_[values['paired_data_uid']] = cls(
                source_uid, asset=asset, **values
            )
        return objects_

    def save(self, **kwargs):

        # When PairedData objects are synchronize by back-end deployment class
        # (i.e.: `sync_media_files()` is triggered), the back-end deployment class
        # also updates the boolean `synced_with_backend`. We must handle this
        # over here before going further to avoid calling `Asset.save()`
        # which would call `sync_media_files()` again,
        # which would make us enter an infinite loop.
        try:
            update_fields = kwargs['update_fields']
        except KeyError:
            pass
        else:
            if 'synced_with_backend' in update_fields:
                AssetFile.objects.filter(uid=self.paired_data_uid).update(
                    synced_with_backend=self.synced_with_backend
                )
                return

        try:
            self.asset.paired_data[self.source_uid]['paired_data_uid']
            # self.paired_data_uid would have been set when `objects()`
            # calls the constructor
        except KeyError:
            self.paired_data_uid = KpiUidField.generate_unique_id('pd')

        self.asset.paired_data[self.source_uid] = {
            'fields': self.fields,
            'filename': self.filename,
            'paired_data_uid': self.paired_data_uid,
        }

        self.asset.save(
            update_fields=['paired_data'],
            adjust_content=False,
            create_version=False,
        )

    def void_external_xml_cache(self):
        # We delete the content of `self.asset_file` to force its regeneration
        # when the 'xml_endpoint' is called
        if self.asset_file and self.asset_file.content:
            self.asset_file.content.delete()

    def update(self, updated_values):
        for key, value in updated_values.items():
            if not hasattr(self, key):
                raise AttributeError(
                    f"'PairedData' object has no attribute '{key}'"
                )
            setattr(self, key, value)

        self.void_external_xml_cache()

