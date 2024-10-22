# coding: utf-8
from django.conf import settings
from rest_framework.response import Response

from kobo.apps.openrosa.apps.api.permissions import ConnectViewsetPermissions
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.libs.mixins.object_lookup_mixin import ObjectLookupMixin
from kobo.apps.openrosa.libs.serializers.user_profile_serializer import (
    UserProfileWithTokenSerializer,
)
from kpi.utils.object_permission import get_database_user
from ..utils.rest_framework.viewsets import OpenRosaGenericViewSet


class ConnectViewSet(ObjectLookupMixin, OpenRosaGenericViewSet):
    """
    This endpoint allows you retrieve the authenticated user's profile info.

    ## Retrieve profile
    > Example
    >
    >       curl -X GET https://example.com/api/v1/user

    > Response:

    >       {
                "api_token": "76121138a080c5ae94f318a8b9be91e7ebebb484",
                "city": "Nairobi",
                "country": "Kenya",
                "gravatar": "avatar.png",
                "name": "Demo User",
                "organization": "",
                "require_auth": false,
                "twitter": "",
                "url": "http://localhost:8000/api/v1/profiles/demo",
                "user": "http://localhost:8000/api/v1/users/demo",
                "username": "demo",
                "website": ""
    }

    """
    lookup_field = 'user'
    queryset = UserProfile.objects.all()
    permission_classes = (ConnectViewsetPermissions,)
    serializer_class = UserProfileWithTokenSerializer

    def list(self, request, *args, **kwargs):
        """
        Returns authenticated user profile
        """

        if request and not request.user.is_anonymous:
            session = getattr(request, 'session')
            if not session.session_key:
                # login user to create session token
                # TODO cannot call this without calling authenticate first or
                # setting the backend, commented for now.
                # login(request, request.user)
                session.set_expiry(settings.DEFAULT_SESSION_EXPIRY_TIME)

        user = get_database_user(request.user)

        serializer = UserProfileWithTokenSerializer(
            instance=UserProfile.objects.get_or_create(user=user)[0],
            context={'request': request})

        return Response(serializer.data)
