from django.contrib.auth import get_user_model
from rest_framework import mixins, renderers

from kobo.apps.openrosa.libs.utils.storage import rmdir
from ..permissions import UserDeletePermission
from ..utils.rest_framework.viewsets import OpenRosaGenericViewSet


class UserViewSet(mixins.DestroyModelMixin, OpenRosaGenericViewSet):

    lookup_field = 'username'
    queryset = get_user_model().objects.all()
    permission_classes = [UserDeletePermission]
    renderer_classes = (renderers.JSONRenderer,)

    def perform_destroy(self, instance):
        username = instance.username
        instance.delete()
        if username:
            rmdir(f'{username}')
