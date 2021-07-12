# coding: utf-8
import time
from typing import Union

from django.conf import settings
from rest_framework.reverse import reverse

from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import KpiUidField
from kpi.interfaces import (
    OpenRosaManifestInterface,
    SyncBackendMediaInterface,
)
from kpi.models.asset_file import AssetFile
from kpi.utils.hash import get_hash


class PairedData(OpenRosaManifestInterface,
                 SyncBackendMediaInterface):

    # `filename` implements:
    # - `OpenRosaManifestInterface.filename()`
    # - `SyncBackendMediaInterface.filename()`
    filename = None

    def __init__(
        self,
        source_asset_or_uid: Union['kpi.models.Asset', str],
        filename: str,
        fields: list,
        asset: 'kpi.models.Asset',
        paired_data_uid: str = None,
        hash_: str = None,
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
        TODO: document `hash_` (it is currently used to set a value that would
        never match the hash of real content, to force synchronization)
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

        if not hash_:
            self.generate_hash()
        else:
            self.__hash = hash_

    def __str__(self):
        return f'<PairedData {self.paired_data_uid} ({self.filename})>'

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
        try:
            asset_file = AssetFile.objects.get(uid=self.paired_data_uid)
        except AssetFile.DoesNotExist:
            pass
        else:
            asset_file.delete()

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

    def generate_hash(self):
        # It generates the hash based on the related AssetFile content.
        # If the file does not exist yet, the hash is randomly generated with
        # the current timestamp and `self.backend_media_id`. A hash is needed
        # to synchronize with KoBoCAT
        try:
            asset_file = AssetFile.objects.get(uid=self.paired_data_uid)
        except AssetFile.DoesNotExist:
            self.__hash = get_hash(
                f'{str(time.time())}.{self.backend_media_id}',
                prefix=True
            )
        else:
            # Use `fast=True` because the file can increase pretty quickly and
            # can be become gigantic.
            # Moreover, if matches KoBoCAT setting when generating a hash for
            # paired data XML files.
            self.__hash = get_hash(asset_file.content, fast=True, prefix=True)

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
        return self.__hash

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
        try:
            self.asset.paired_data[self.source_uid]['paired_data_uid']
            # self.paired_data_uid would have been set when `objects()`
            # calls the constructor
        except KeyError:
            self.paired_data_uid = KpiUidField.generate_unique_id('pd')

        generate_hash = kwargs.pop('generate_hash', False)
        if generate_hash:
            self.generate_hash()

        self.asset.paired_data[self.source_uid] = {
            'fields': self.fields,
            'filename': self.filename,
            'paired_data_uid': self.paired_data_uid,
            'hash_': self.__hash
        }

        self.asset.save(
            update_fields=['paired_data'],
            adjust_content=False,
            create_version=False,
        )

    def update(self, updated_values):
        for key, value in updated_values.items():
            if not hasattr(self, key):
                continue
            setattr(self, key, value)

        self.generate_hash()
