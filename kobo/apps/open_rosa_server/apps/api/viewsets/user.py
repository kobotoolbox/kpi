from django.contrib.auth import get_user_model
from rest_framework import viewsets, mixins, renderers

from kobo.apps.open_rosa_server.libs.utils.storage import rmdir
from ..permissions import UserDeletePermission


class UserViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):

    lookup_field = 'username'
    queryset = get_user_model().objects.all()
    permission_classes = [UserDeletePermission]
    renderer_classes = (renderers.JSONRenderer,)

    def perform_destroy(self, instance):
        username = instance.username
        instance.delete()
        if username:
            rmdir(f'{username}')
