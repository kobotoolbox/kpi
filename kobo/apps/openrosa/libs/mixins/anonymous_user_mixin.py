# coding: utf-8
from django.conf import settings
from django.shortcuts import get_object_or_404

from kobo.apps.kobo_auth.shortcuts import User


class AnonymousUserMixin:

    def get_queryset(self):
        """
        Set AnonymousUser from the database to allow object permissions.
        """
        if self.request and self.request.user.is_anonymous:
            self.request.user = get_object_or_404(
                User, pk=settings.ANONYMOUS_USER_ID)

        return super().get_queryset()
