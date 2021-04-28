from __future__ import unicode_literals

from django.contrib.staticfiles.storage import staticfiles_storage


def absolute_url(path):
    if path.startswith(u'http://') or path.startswith(u'https://') or path.startswith(u'/'):
        return path
    return staticfiles_storage.url(path)
