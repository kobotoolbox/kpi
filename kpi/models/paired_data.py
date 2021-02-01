# coding: utf-8
import time
from typing import Union

from django.conf import settings
from rest_framework.reverse import reverse

from kpi.fields import KpiUidField
from kpi.utils.hash import get_hash


class PairedData:

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
        self.filename = filename
        self.fields = fields
        self.deleted_at = None
        if not paired_data_uid:
            self.paired_data_uid = KpiUidField.generate_unique_id('pd')
        else:
            self.paired_data_uid = paired_data_uid

        if not hash_:
            self.__generate_hash()
        else:
            self.__hash = hash_

    def __str__(self):
        return f'<PairedData {self.paired_data_uid} ({self.filename})>'

    def delete(self, **kwargs):
        del self.asset.paired_data[self.parent_uid]
        self.asset.save(
            update_fields=['paired_data'],
            adjust_content=False,
            create_version=False,
        )

    def generate_hash(self):
        self.__hash = get_hash(
            f'{self.kc_metadata_uniqid}.{str(time.time())}'
        )

    def get_parent(self) -> Union['Asset', None]:

        # Avoid circular import
        Asset = self.asset.__class__  # noqa
        try:
            parent_asset = Asset.objects.get(uid=self.parent_uid)
        except Asset.DoesNotExist:
            return None

        # Data sharing must be enabled on the parent
        parent_data_sharing = parent_asset.data_sharing
        if not parent_data_sharing.get('enabled'):
            return None

        # Validate `self.owner` is still allowed to see parent data
        # ToDo : `self.owner` should have `PERM_VIEW_ASSET` on parent too
        allowed_users = parent_data_sharing.get('users', [])
        if allowed_users and self.asset.owner.username not in allowed_users:
            return None

        return parent_asset

    @property
    def kc_metadata_data_value(self):
        return self.kc_metadata_uniqid

    @property
    def kc_metadata_uniqid(self):
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

    @property
    def hash(self):
        return f'md5:{self.__hash}'

    @property
    def is_remote_url(self):
        return True

    @property
    def mimetype(self):
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
