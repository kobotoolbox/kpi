# coding: utf-8
import os

from django.conf import settings


def viewer_fixture_path(*args):
    return os.path.join(settings.OPENROSA_APP_DIR, 'apps', 'viewer',
                        'tests', 'fixtures', *args)
