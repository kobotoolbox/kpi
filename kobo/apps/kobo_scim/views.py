import re

from django.conf import settings
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.authentication import IsAuthenticatedIdP, SCIMAuthentication
from kobo.apps.kobo_scim.pagination import SCIMPagination
from kobo.apps.kobo_scim.serializers import ScimUserSerializer


@extend_schema(tags=['SCIM'])
@extend_schema_view(
    list=extend_schema(
        description='Returns a list of SCIM users matching the optional query'
    ),
    retrieve=extend_schema(description='Returns a specific SCIM user.'),
)
class ScimUserViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """
    SCIM 2.0 compliant Users API endpoint.
    - GET /Users
    - GET /Users/{user_id}
    """

    queryset = User.objects.all().order_by('id')
    serializer_class = ScimUserSerializer
    authentication_classes = [SCIMAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    pagination_class = SCIMPagination

    def get_queryset(self):
        # The idp_slug in the URL MUST match the authenticated IdP
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            # Return empty if cross-tenant or missing
            return User.objects.none()

        # Remove the AnonymousUser from SCIM listings
        queryset = super().get_queryset().exclude(id=settings.ANONYMOUS_USER_ID)

        filter_param = self.request.query_params.get('filter')
        if filter_param:
            # We look for simple expressions like: userName eq "email@example.com"
            # Since the requirement is "Kobo should automatically disable all accounts
            # linked to the same email address", filtering by email is critical.
            match = re.search(
                r'(userName|emails(\.value)?)\s+eq\s+"([^"]+)"', filter_param
            )
            if match:
                field, _, value = match.groups()
                if field == 'userName':
                    queryset = queryset.filter(username__iexact=value)
                elif field.startswith('emails'):
                    queryset = queryset.filter(email__iexact=value)

        return queryset
