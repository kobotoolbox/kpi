from rest_framework.permissions import DjangoObjectPermissions

from kobo.apps.accounts.utils import user_is_managed_by_sso


class NotManagedSSOPermission(DjangoObjectPermissions):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return not user_is_managed_by_sso(request.user)
