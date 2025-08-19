from rest_framework.permissions import IsAdminUser

from kpi.constants import PERM_MANAGE_ASSET
from kpi.mixins.validation_password_permission import ValidationPasswordPermissionMixin
from kpi.permissions import IsAuthenticated


class SuperUserPermission(ValidationPasswordPermissionMixin, IsAdminUser):

    def has_permission(self, request, view):
        self.validate_password(request)
        return bool(request.user and request.user.is_superuser)


class ViewProjectHistoryLogsPermission(IsAuthenticated):

    def has_permission(self, request, view):
        has_asset_perm = bool(
            request.user
            and view.asset.has_perm(user_obj=request.user, perm=PERM_MANAGE_ASSET)
        )
        return has_asset_perm and super().has_permission(request, view)
