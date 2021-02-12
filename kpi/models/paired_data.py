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
from kpi.interfaces.sync_backend_media import SyncBackendMediaInterface
from kpi.utils.hash import get_hash


class PairedData(SyncBackendMediaInterface):

    def __init__(
        self,
        parent_uid: str,
        filename: str,
        fields: list,
        asset: 'kpi.models.Asset',
        paired_data_uid: str = None,
        hash_: str = None,
    ):
        self.parent_uid = parent_uid
        self.asset = asset
        self.__filename = filename
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
    def backend_data_value(self):
        """
        Implements `SyncBackendMediaInterface.backend_data_value()`
        """
        return self.backend_uniqid

    @property
    def backend_uniqid(self):
        """
        Implements `SyncBackendMediaInterface.backend_uniqid()`
        """
        from kpi.urls.router_api_v2 import URL_NAMESPACE  # avoid circular imports # noqa
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
        del self.asset.paired_data[self.parent_uid]
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
    def filename(self):
        """
        Implements `SyncBackendMediaInterface.filename()`
        """
        return self.__filename

    def generate_hash(self):
        self.__hash = get_hash(
            f'{self.backend_uniqid}.{str(time.time())}'
        )

    def get_parent(self) -> Union['Asset', None]:

        # Avoid circular import
        Asset = self.asset.__class__  # noqa
        try:
            parent_asset = Asset.objects.get(uid=self.parent_uid)
        except Asset.DoesNotExist:
            return None

        # Data sharing must be enabled on the parent
        if not parent_asset.data_sharing.get('enabled'):
            return None

        # Validate `self.owner` is still allowed to see parent data.
        # Their permissions could have been revoked since they linked their
        # form to parent asset.
        required_perms = [
            PERM_PARTIAL_SUBMISSIONS,
            PERM_VIEW_SUBMISSIONS,
        ]
        if not parent_asset.has_perms(self.asset.owner, required_perms):
            return None

        return parent_asset

    @property
    def hash(self):
        """
        Implements `SyncBackendMediaInterface.hash()`
        """
        return f'md5:{self.__hash}'

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
        for parent_uid, values in asset.paired_data.items():
            objects_[values['paired_data_uid']] = cls(
                parent_uid, asset=asset, **values
            )
        return objects_

    def save(self, **kwargs):
        try:
            self.asset.paired_data[self.parent_uid]['paired_data_uid']
        except KeyError:
            self.paired_data_uid = KpiUidField.generate_unique_id('pd')

        generate_hash = kwargs.pop('generate_hash', False)
        if generate_hash:
            self.generate_hash()

        self.asset.paired_data[self.parent_uid] = {
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

        self.__hash = get_hash(
            f'{self.kc_metadata_uniqid}.{str(time.time())}'
        )
