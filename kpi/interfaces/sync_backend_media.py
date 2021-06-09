# coding: utf-8
from abc import ABCMeta, abstractmethod


class SyncBackendMediaInterface(metaclass=ABCMeta):
    """
    This interface defines required properties and methods of objects passed to
    deployment back-end class on media synchronization.
    """

    # Type of file sent to back end during synchronization
    BACKEND_DATA_TYPE = None

    @property
    @abstractmethod
    def backend_data_value(self):
        pass

    @property
    @abstractmethod
    def backend_data_type():
        pass

    @property
    @abstractmethod
    def backend_uniqid(self):
        pass

    @abstractmethod
    def delete(self, **kwargs):
        pass

    @property
    @abstractmethod
    def deleted_at(self):
        pass

    @property
    @abstractmethod
    def filename(self):
        pass

    @property
    @abstractmethod
    def md5_hash(self):
        pass

    @property
    @abstractmethod
    def is_remote_url(self):
        pass

    @property
    @abstractmethod
    def mimetype(self):
        pass


