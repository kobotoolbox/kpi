# coding: utf-8
from abc import ABCMeta, abstractmethod


class SyncBackendMediaInterface(metaclass=ABCMeta):
    """
    This interface defines required properties and methods of objects passed to
    deployment back-end class on media synchronization.
    """

    @property
    @abstractmethod
    def backend_media_id(self):
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

    # FIXME in ABC PR #3268
    # @property
    # def file_type(self):
    #     raise AbstractPropertyError

    @property
    @abstractmethod
    def md5_hash(self):
        """
        Return md5 hash string needed to establish the list of files to synchronize
        between KPI and back-end server
        """
        pass

    @property
    @abstractmethod
    def is_remote_url(self):
        pass

    @property
    @abstractmethod
    def mimetype(self):
        pass


