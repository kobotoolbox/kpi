# coding: utf-8
from kpi.exceptions import AbstractMethodError, AbstractPropertyError


class SyncBackendMediaInterface:
    """
    This interface defines required properties and methods
    of objects passed to deployment back-end class on media synchronization.

    """

    # Type of file sent to back end during synchronization
    BACKEND_DATA_TYPE = None

    @property
    def backend_data_value(self):
        raise AbstractPropertyError

    @property
    def backend_data_type(self):
        raise AbstractPropertyError

    @property
    def backend_uniqid(self):
        raise AbstractPropertyError

    def delete(self, **kwargs):
        raise AbstractMethodError

    @property
    def deleted_at(self):
        raise AbstractPropertyError

    @property
    def filename(self):
        raise AbstractPropertyError

    @property
    def md5_hash(self):
        raise AbstractPropertyError

    @property
    def is_remote_url(self):
        raise AbstractPropertyError

    @property
    def mimetype(self):
        raise AbstractPropertyError


