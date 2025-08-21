from constance import config
from django.db import transaction
from django.utils.timezone import now
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.schema_extensions.v2.me.serializers import (
    CurrentUserDeleteRequest,
    MeListResponse,
)
from kpi.serializers import CurrentUserSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_204_empty_response,
)
from kpi.versioning import APIV2Versioning


@extend_schema(tags=['Me'])
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('kpi', 'me/delete.md'),
        request={'application/json': CurrentUserDeleteRequest},
        responses=open_api_204_empty_response(
            raise_not_found=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'me/retrieve.md'),
        responses=open_api_200_ok_response(
            MeListResponse,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'me/update.md'),
        responses=open_api_200_ok_response(
            MeListResponse, raise_not_found=False, raise_access_forbidden=False
        ),
    ),
)
class CurrentUserViewSet(viewsets.ModelViewSet):
    """
    Available actions:
    - destroy               → DELETE        /me/
    - retrieve              → GET           /me/
    - partial_update        → PATCH         /me/

    Documentation:
    - docs/api/v2/me/delete.md
    - docs/api/v2/me/retrieve.md
    - docs/api/v2/me/update.md
    """
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    versioning_class = APIV2Versioning

    def get_object(self):
        return self.request.user

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        confirm = request.data.get('confirm')
        if confirm != user.extra_details.uid:
            return Response(
                {'detail': t('Invalid confirmation')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = {'pk': user.pk, 'username': user.username}

        with transaction.atomic():
            # If user is already in trash, it should raise a `TrashIntegrityError`
            # but it should never happen since no non-active/trashed users should be
            # able to call this endpoint. A 403 should occur before.
            move_to_trash(
                request.user, [user], config.ACCOUNT_TRASH_GRACE_PERIOD, 'user'
            )
            request.user.is_active = False
            request.user.save(update_fields=['is_active'])
            request.user.extra_details.date_removal_requested = now()
            request.user.extra_details.save(
                update_fields=['date_removal_requested']
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
