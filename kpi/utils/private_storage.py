# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.settings import api_settings


def superuser_or_username_matches_prefix(private_file):
    """
    You can create a custom function, and use that instead. The function
    receives a private_storate.models.PrivateFile object, which has the
    following fields:

        request: the Django request.
        storage: the storage engine used to retrieve the file.
        relative_name: the file name in the storage.
        full_path: the full file system path.
        exists(): whether the file exists.
        content_type: the HTTP content type.

    (See https://github.com/edoburu/django-private-storage)
    """
    request = private_file.request

    user = get_user_from_authentication(request)

    if not user.is_authenticated():
        return False
    if user.is_superuser:
        return True
    if private_file.relative_name.startswith(
        '{}/'.format(user.username)
    ):
        return True

    return False


def get_user_from_authentication(request):
    drf_request = Request(request)
    for auth_class in api_settings.DEFAULT_AUTHENTICATION_CLASSES:

        try:
            # TODO - Find out why `AuthenticationFailed` returns 500
            #  instead of 401.
            auth_tuple = auth_class().authenticate(drf_request)
        except AuthenticationFailed:
            continue

        if auth_tuple is not None:
            # `DEFAULT_AUTHENTICATION_CLASSES` are ordered and the
            # first match wins; don't look any further
            return auth_tuple[0]

    return AnonymousUser()
