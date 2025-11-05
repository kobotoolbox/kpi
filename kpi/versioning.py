from rest_framework.versioning import NamespaceVersioning

from kpi.constants import API_NAMESPACES


class APIAutoVersioning(NamespaceVersioning):

    def get_versioned_viewname(self, viewname, request):
        # V1 doesn't have any version detected and equals `None`
        if request.version:
            return request.version + ':' + viewname
        return viewname


class APIV2Versioning(APIAutoVersioning):

    def determine_version(self, request, *args, **kwargs):
        return API_NAMESPACES['v2']


class OpenRosaAPIVersioning(APIAutoVersioning):
    """
    Custom API versioning class used to tag requests as belonging to the
    'openrosa' schema. This is not intended to represent a real API version,
    but rather to ensure that endpoints are grouped under the correct schema
    during generation (e.g., when building OpenAPI docs).
    """

    def determine_version(self, request, *args, **kwargs):
        return 'openrosa'
