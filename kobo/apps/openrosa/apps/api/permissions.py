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


class SubmissionObjectPermissions(AssetObjectPermissions):
    """
    Allow reading only to users who can view all the submissions.
    """

    perms_map = {
        **AssetObjectPermissions.perms_map,
        'GET': ['kpi.view_submissions'],
        'HEAD': ['kpi.view_submissions'],
    }


__permissions__ = [DjangoObjectPermissions, IsAuthenticated]
