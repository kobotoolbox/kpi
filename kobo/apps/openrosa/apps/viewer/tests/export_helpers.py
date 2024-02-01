# coding: utf-8
import os

from django.conf import settings


def viewer_fixture_path(*args):
    return os.path.join(settings.kobo.apps.open_rosa_server_DIR, 'apps', 'viewer',
                        'tests', 'fixtures', *args)
