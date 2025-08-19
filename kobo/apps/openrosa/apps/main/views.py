# coding: utf-8
from django.conf import settings


def _get_migrate_url(username):
    return '{kf_url}/api/v2/users/{username}/migrate/'.format(
        kf_url=settings.KOBOFORM_URL, username=username
    )
