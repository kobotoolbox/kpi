# coding: utf-8
from rest_framework.request import Request as DRFRequest
from rest_framework.settings import api_settings

from kpi.utils.object_permission import get_database_user


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

    user = private_file.request.user

    if not user.is_authenticated:
        # Try all the DRF authentication methods before giving up
        request = DRFRequest(
            private_file.request,
            authenticators=[
                auth() for auth in api_settings.DEFAULT_AUTHENTICATION_CLASSES
            ],
        )
        user = request.user

    user = get_database_user(user)
    if user.is_superuser:
        return True

    if private_file.relative_name.startswith(
        '{}/'.format(user.username)
    ):
        return True

    return False
