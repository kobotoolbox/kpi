# coding: utf-8
from django.contrib.auth.models import User
from rest_framework import renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.serializers import CurrentUserSerializer
from kpi.utils.permissions import grant_default_model_level_perms


class CurrentUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user

    @action(detail=True, methods=["POST"], renderer_classes=[renderers.JSONRenderer])
    def grant_default_model_level_perms(self, request, *args, **kwargs):
        user = self.get_object()
        grant_default_model_level_perms(user)

        return Response(
            data={
                "detail": (
                    "Successfully granted default model level "
                    f"perms to user {user.username}"
                )
            },
            status=status.HTTP_200_OK
        )
