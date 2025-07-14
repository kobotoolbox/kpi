# coding: utf-8
from django.contrib.auth.models import Permission
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer

from kpi.models.asset import Asset
from kpi.schema_extensions.v2.permissions.serializers import PermissionResponse
from kpi.serializers.v2.permission import PermissionSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(
    tags=['Permissions'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'permissions/list.md'),
        responses=open_api_200_ok_response(
            PermissionResponse,
            require_auth=False,
            raise_access_forbidden=False,
            raise_not_found=False,
            validate_payload=False,
        )
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'permissions/retrieve.md'),
        responses=open_api_200_ok_response(
            PermissionResponse,
            require_auth=False,
            raise_access_forbidden=False,
            raise_not_found=False,
            validate_payload=False,
        )
    ),
)
class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for managing permissions

    Available actions:
    - list           → GET /api/v2/permissions/
    - retrieve       → GET /api/v2/assets/{codename}/

    Documentation:
    - docs/api/v2/permissions/list.md
    - docs/api/v2/permissions/retrieve.md
    """

    queryset = Permission.objects.all()
    model = Permission
    lookup_field = 'codename'
    serializer_class = PermissionSerializer
    renderer_classes = [JSONRenderer,]

    def get_queryset(self, *args, **kwargs):
        queryset = super().get_queryset(*args, **kwargs)
        # Codenames are unique per content_type. So, we ensure we don't return
        # codenames for different app or content_type
        queryset = queryset.filter(
            content_type__app_label='kpi',
            content_type__model='asset',
            codename__in=Asset.ASSIGNABLE_PERMISSIONS,
        ).select_related('content_type')
        return queryset
