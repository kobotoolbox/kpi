from rest_framework.permissions import DjangoObjectPermissions, IsAuthenticated


class AssetObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        'GET': ['kpi.view_asset'],
        'OPTIONS': [],
        'HEAD': [],
        'POST': ['kpi.add_asset'],
        'PUT': ['kpi.change_asset'],
        'PATCH': ['kpi.change_asset'],
        'DELETE': ['kpi.delete_asset'],
    }


__permissions__ = [DjangoObjectPermissions, IsAuthenticated]
