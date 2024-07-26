# coding: utf-8
from django.shortcuts import get_object_or_404
from rest_framework import exceptions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.kobo_auth.shortcuts import User


class TokenView(APIView):
    def _which_user(self, request):
        """
        Determine the user from `request`, allowing superusers to specify
        another user by passing the `username` query parameter
        """
        if request.user.is_anonymous:
            raise exceptions.NotAuthenticated()

        if 'username' in request.query_params:
            # Allow superusers to get others' tokens
            if request.user.is_superuser:
                user = get_object_or_404(
                    User,
                    username=request.query_params['username']
                )
            else:
                raise exceptions.PermissionDenied()
        else:
            user = request.user
        return user

    def get(self, request, *args, **kwargs):
        """ Retrieve an existing token, or create and retrieve a new one """
        user = self._which_user(request)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})

    def post(self, request, *args, **kwargs):
        """
        Return a token, creating a new one if none exists. Unnecessary now that
        GET also creates a token, but left here for API stability
        """
        user = self._which_user(request)
        token, created = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    def delete(self, request, *args, **kwargs):
        """ Delete an existing token and do not generate a new one """
        user = self._which_user(request)
        token = get_object_or_404(Token, user=user)
        # Yes, another thread could delete the token here, but Django's
        # `delete()` does not care whether or not the object being deleted
        # actually exists!
        token.delete()
        return Response({}, status=status.HTTP_204_NO_CONTENT)
