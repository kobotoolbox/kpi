from kobo.apps.accounts.utils import user_is_managed_by_sso
from rest_framework.permissions import DjangoObjectPermissions


class NotManagedSSOPermission(DjangoObjectPermissions):
    def has_object_permission(self, request, view, obj):
        return not user_is_managed_by_sso(request.user)

