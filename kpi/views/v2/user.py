# coding: utf-8
from django.contrib.auth.models import User
from rest_framework import exceptions, mixins, viewsets

from kpi.models.authorized_application import ApplicationTokenAuthentication
from kpi.serializers.v2.user import UserSerializer


class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    """
    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'username'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.authentication_classes += [ApplicationTokenAuthentication]

    def list(self, request, *args, **kwargs):
        raise exceptions.PermissionDenied()
