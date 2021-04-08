# coding: utf-8
from kpi.exceptions import AbstractMethodError, AbstractPropertyError


class OpenRosaFormListInterface:

    @property
    def description(self):
        raise AbstractPropertyError

    @property
    def form_id(self):
        raise AbstractPropertyError

    def get_download_url(self, request):
        raise AbstractMethodError

    def get_manifest_url(self, request):
        raise AbstractMethodError

    @property
    def hash(self):
        raise AbstractPropertyError

    @property
    def name(self):
        raise AbstractPropertyError


class OpenRosaManifestInterface:

    @property
    def filename(self):
        raise AbstractPropertyError

    def get_download_url(self, request):
        raise AbstractMethodError

    @property
    def hash(self):
        raise AbstractPropertyError
