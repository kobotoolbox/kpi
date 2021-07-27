# coding: utf-8
from abc import ABCMeta, abstractmethod


class OpenRosaFormListInterface(metaclass=ABCMeta):
    """
    This interface defines required properties and methods of objects expected
    by `kpi.serializers.v2.open_rosa.FormListSerializer`
    """
    @property
    @abstractmethod
    def description(self):
        pass

    @property
    @abstractmethod
    def form_id(self):
        pass

    @abstractmethod
    def get_download_url(self, request):
        pass

    @abstractmethod
    def get_manifest_url(self, request):
        pass

    @property
    @abstractmethod
    def md5_hash(self):
        pass

    @property
    @abstractmethod
    def name(self):
        pass


class OpenRosaManifestInterface(metaclass=ABCMeta):
    """
    This interface defines required properties and methods of objects expected
    by `kpi.serializers.v2.open_rosa.ManifestSerializer`
    """
    @property
    @abstractmethod
    def filename(self):
        pass

    @abstractmethod
    def get_download_url(self, request):
        pass

    @property
    @abstractmethod
    def md5_hash(self):
        pass
