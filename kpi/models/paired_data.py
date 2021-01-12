# coding: utf-8
import time
from django.conf import settings
from rest_framework.reverse import reverse

from kpi.utils.hash import get_hash


class PairedData:

    def __init__(self, paired_data: dict, asset_uid: str):
        self.__paired_data_uid = paired_data['paired_data_uid']
        self.__asset_uid = asset_uid
        self.__hash = get_hash(f'{self.kc_metadata_uniqid}.{str(time.time())}')
        self.__filename = paired_data['filename']
        self.deleted_at = None

    def delete(self, **kwargs):
        pass

    @property
    def filename(self):
        return self.__filename

    @property
    def kc_metadata_data_value(self):
        return self.kc_metadata_uniqid

    @property
    def kc_metadata_uniqid(self):
        from kpi.urls.router_api_v2 import URL_NAMESPACE  # avoid circular imports # noqa
        paired_data_url = reverse(
            f'{URL_NAMESPACE}:asset-paired-data',
            kwargs={
                'uid': self.__asset_uid,
                'paired_data_uid': self.__paired_data_uid,
                'format': 'xml'
            },
        )
        return f'{settings.KOBOFORM_INTERNAL_URL}{paired_data_url}'

    @property
    def hash(self):
        return f'md5:{self.__hash}'

    @property
    def is_remote_url(self):
        return True

    @property
    def mimetype(self):
        return 'application/xml'

