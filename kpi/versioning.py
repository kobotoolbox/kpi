# coding: utf-8
from rest_framework.versioning import NamespaceVersioning


class APIAutoVersioning(NamespaceVersioning):

    def get_versioned_viewname(self, viewname, request):
        # V1 doesn't have any version detected and equals `None`
        if request.version:
            return request.version + ':' + viewname
        return viewname


class APIV2Versioning(APIAutoVersioning):

    def determine_version(self, request, *args, **kwargs):
        return 'api_v2'
