from django.contrib.auth.models import AnonymousUser
from django.utils.translation import gettext_lazy as _
from rest_framework import authentication, exceptions, permissions

from kobo.apps.kobo_scim.models import IdentityProvider


class SCIMAuthentication(authentication.BaseAuthentication):
    """
    SCIM API Key Authentication.
    Validates a Bearer token against the `scim_api_key` field of active
    IdentityProviders.

    The SCIM RFC expects: `Authorization: Bearer <token>`
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        token = parts[1]

        try:
            idp = IdentityProvider.objects.get(scim_api_key=token, is_active=True)
        except IdentityProvider.DoesNotExist:
            raise exceptions.AuthenticationFailed(_('Invalid or inactive SCIM token.'))

        # We return (AnonymousUser(), idp) because SCIM API does not necessarily
        # authenticate a standard Django `User`, but rather the `IdentityProvider`.
        # `request.auth` will be the IdentityProvider instance.
        return (AnonymousUser(), idp)

    def authenticate_header(self, request):
        return 'Bearer'


class IsAuthenticatedIdP(permissions.BasePermission):
    """
    Allows access only to authenticated IdentityProviders.
    """

    def has_permission(self, request, view):
        return request.auth and isinstance(request.auth, IdentityProvider)
