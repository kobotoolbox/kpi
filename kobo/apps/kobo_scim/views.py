import logging
import re

logger = logging.getLogger(__name__)

from django.conf import settings
from django.db import IntegrityError
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.authentication import IsAuthenticatedIdP, ScimAuthentication
from kobo.apps.kobo_scim.models import ScimGroup
from kobo.apps.kobo_scim.pagination import ScimPagination
from kobo.apps.kobo_scim.renderers import SCIMParser, SCIMRenderer
from kobo.apps.kobo_scim.serializers import ScimGroupSerializer, ScimUserSerializer


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
    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    pagination_class = ScimPagination
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer, JSONRenderer]

    def create(self, request, *args, **kwargs):
        """
        Catch POST requests (user provisioning).
        Currently, user creation via SCIM is not supported as users are created via SSO.
        We log the payload to help debug IdP behavior and return a clear error.
        """
        logger.warning(
            "SCIM User Provisioning attempt blocked. IdP slug: %s, Payload: %s",
            self.kwargs.get('idp_slug'),
            request.data
        )
        # Return a SCIM-compliant error response
        return Response(
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
                "detail": "User creation via SCIM is not supported. Users are provisioned via SSO login.",
                "status": "403"
            },
            status=status.HTTP_403_FORBIDDEN
        )


    def get_queryset(self):
        # The idp_slug in the URL MUST match the authenticated IdP
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            # Return empty if cross-tenant or missing
            return User.objects.none()

        # Remove the AnonymousUser from SCIM listings
        queryset = super().get_queryset().exclude(id=settings.ANONYMOUS_USER_ID)

        # Only include users that are linked to this IdP's SocialApp.
        if idp.social_app:
            queryset = queryset.filter(
                socialaccount__provider=idp.social_app.provider_id
            )
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
        email_target = instance.email
        if email_target:
            targets = User.objects.filter(email__iexact=email_target)
        else:
            targets = User.objects.filter(pk=instance.pk)
        users = list(targets.select_related('extra_details'))

        targets.update(is_active=False)

        # Create audit logs as System-initiated events
        idp_slug = self.kwargs.get('idp_slug')
        audit_logs = []

        for user in users:
            metadata = {
                'idp_slug': idp_slug,
                'deactivated_email': email_target,
                'username': user.username,
                'initiated_via': 'SCIM_API',
                'info': 'Automated deactivation via Identity Provider',
            }

            user_uid = getattr(
                getattr(user, 'extra_details', None), 'uid', None
            ) or str(user.id)

            log = AuditLog(
                user=user,
                user_uid=user_uid,
                app_label=user._meta.app_label,
                model_name=user._meta.model_name,
                object_id=user.id,
                action=AuditAction.DEACTIVATION,
                log_type=AuditType.USER_MANAGEMENT,
                metadata=metadata,
            )
            audit_logs.append(log)

        if audit_logs:
            # bulk_create bypasses save(), so we must set user_uid
            # explicitly (done above)
            AuditLog.objects.bulk_create(audit_logs)

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


@extend_schema(tags=['SCIM'])
@extend_schema_view(
    get=extend_schema(description='Returns the SCIM Service Provider Configuration.'),
)
class ScimServiceProviderConfigView(APIView):
    """
    SCIM 2.0 compliant ServiceProviderConfig endpoint.
    - GET /ServiceProviderConfig
    """

    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer, JSONRenderer]

    def get(self, request, *args, **kwargs):
        # We only support patch and basic filtering
        payload = {
            'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            'patch': {'supported': True},
            'bulk': {'supported': False},
            'filter': {'supported': True, 'maxResults': 100},
            'changePassword': {'supported': False},
            'sort': {'supported': False},
            'etag': {'supported': False},
        }
        return Response(payload, status=status.HTTP_200_OK)


@extend_schema(tags=['SCIM'])
@extend_schema_view(
    list=extend_schema(description='Returns a list of SCIM groups.'),
    retrieve=extend_schema(description='Returns a specific SCIM group.'),
    create=extend_schema(description='Creates a new SCIM group.'),
    destroy=extend_schema(description='Deletes a SCIM group.'),
    partial_update=extend_schema(
        description='Updates a SCIM group. '
        'Supports adding/removing members via patch operations.'
    ),
    update=extend_schema(description='Replaces a SCIM group entirely.'),
)
class ScimGroupViewSet(viewsets.ModelViewSet):
    """
    SCIM 2.0 compliant Groups API endpoint.
    - GET /Groups
    - GET /Groups/{group_id}
    - POST /Groups
    - PUT /Groups/{group_id}
    - PATCH /Groups/{group_id}
    - DELETE /Groups/{group_id}
    """

    queryset = ScimGroup.objects.all().order_by('id')
    serializer_class = ScimGroupSerializer
    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    pagination_class = ScimPagination
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer, JSONRenderer]

    def get_queryset(self):
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            return ScimGroup.objects.none()

        queryset = super().get_queryset().filter(idp=idp)

        filter_param = self.request.query_params.get('filter')
        if filter_param:
            match = re.search(r'displayName\s+eq\s+"([^"]+)"', filter_param)
            if match:
                value = match.group(1)
                queryset = queryset.filter(name__iexact=value)

        return queryset

    def perform_create(self, serializer):
        idp = self.request.auth
        displayName = self.request.data.get('displayName', '')
        externalId = self.request.data.get('externalId', '')

        try:
            group = serializer.save(
                idp=idp, name=displayName, scim_external_id=externalId
            )
        except IntegrityError:
            raise ValidationError(
                {'displayName': ['A group with this name already exists.']}
            )

        members_data = self.request.data.get('members', [])
        self._sync_members(group, members_data, idp)

    def perform_update(self, serializer):
        idp = self.request.auth
        displayName = self.request.data.get('displayName', '')
        externalId = self.request.data.get('externalId', '')

        try:
            group = serializer.save(
                idp=idp, name=displayName, scim_external_id=externalId
            )
        except IntegrityError:
            raise ValidationError(
                {'displayName': ['A group with this name already exists.']}
            )

        if 'members' in self.request.data:
            members_data = self.request.data.get('members', [])
            self._sync_members(group, members_data, idp, replace=True)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        operations = request.data.get('Operations', [])

        for op in operations:
            op_type = op.get('op', '').lower()
            path = op.get('path', '')
            value = op.get('value')

            if op_type == 'add':
                if path == 'members':
                    self._add_members(instance, value, request.auth)
                elif isinstance(value, dict) and 'members' in value:
                    self._add_members(instance, value['members'], request.auth)

            elif op_type in ('remove', 'delete'):
                if path == 'members':
                    self._remove_members(instance, value, request.auth)
                # Sometimes path is 'members[value eq "123"]'
                elif path.startswith('members[value eq '):
                    match = re.search(r'members\[value eq "([^"]+)"\]', path)
                    if match:
                        user_id = match.group(1)
                        self._remove_members(
                            instance, [{'value': user_id}], request.auth
                        )

            elif op_type == 'replace':
                if path == 'displayName' and value:
                    instance.name = value
                    instance.save(update_fields=['name'])
                elif path == 'members':
                    self._sync_members(instance, value, request.auth, replace=True)

        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _sync_members(self, group, members_data, idp, replace=False):
        users_to_add = set()
        for member_data in members_data:
            user_id = member_data.get('value')
            if user_id:
                try:
                    user = User.objects.get(id=user_id)
                    # We could also verify if the user belongs to the IdP's social app
                    users_to_add.add(user)
                except User.DoesNotExist:
                    pass

        if replace:
            group.members.set(users_to_add)
        else:
            group.members.add(*users_to_add)

    def _add_members(self, group, members_data, idp):
        if not members_data:
            return
        if not isinstance(members_data, list):
            members_data = [members_data]

        self._sync_members(group, members_data, idp, replace=False)

    def _remove_members(self, group, members_data, idp):
        if not members_data:
            return
        if not isinstance(members_data, list):
            members_data = [members_data]

        users_to_remove = []
        for member_data in members_data:
            # Depending on path filtering, `value` might just be a string
            # if sent incorrectly, but usually it's dict `{"value": "123"}`
            user_id = (
                member_data.get('value')
                if isinstance(member_data, dict)
                else member_data
            )
            if user_id:
                try:
                    user = User.objects.get(id=user_id)
                    users_to_remove.append(user)
                except User.DoesNotExist:
                    pass

        if users_to_remove:
            group.members.remove(*users_to_remove)
