# coding: utf-8
from rest_framework.versioning import NamespaceVersioning


class APIVersioning(NamespaceVersioning):

    def get_versioned_viewname(self, viewname, request):
        # V1 doesn't have any version detected and equals `None`
        if request.version:
            return request.version + ':' + viewname
        return viewname
