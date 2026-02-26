import re

from django.conf import settings
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

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
    destroy=extend_schema(
        description="Deactivates all Kobo accounts linked to the user's email address."
    ),
    partial_update=extend_schema(
        description='Updates a SCIM user. Currently only supports deactivation '
        'via the `active` attribute.'
    ),
)
class ScimUserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
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

        # Only include users that are linked to this IdP's SocialApp
        if idp.social_app:
            queryset = queryset.filter(socialaccount__provider=idp.social_app.provider_id)
        else:
            # If the IdP doesn't have a SocialApp, it can't be mapped to any users
            return User.objects.none()

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

    def perform_destroy(self, instance):
        # Kobo should automatically disable all accounts linked
        # to the same email address
        if instance.email:
            User.objects.filter(email__iexact=instance.email).update(is_active=False)
        else:
            # Fallback if no email is set
            User.objects.filter(pk=instance.pk).update(is_active=False)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        operations = request.data.get('Operations', [])

        deactivate = False
        for op in operations:
            if op.get('op', '').lower() == 'replace' and op.get('path') == 'active':
                if op.get('value') is False:
                    deactivate = True

        if deactivate:
            # Reuse the destroy logic which deactivates the user(s)
            self.perform_destroy(instance)
            # SCIM expects the updated resource returned on successful PATCH
            instance.refresh_from_db()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(
            {'detail': 'Operation not supported or invalid'},
            status=status.HTTP_400_BAD_REQUEST,
        )
