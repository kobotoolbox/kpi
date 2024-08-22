from rest_framework.permissions import IsAdminUser

from kpi.mixins.validation_password_permission import (
    ValidationPasswordPermissionMixin,
)


class SuperUserPermission(ValidationPasswordPermissionMixin, IsAdminUser):

    def has_permission(self, request, view):
        self.validate_password(request)
        return bool(request.user and request.user.is_superuser)
