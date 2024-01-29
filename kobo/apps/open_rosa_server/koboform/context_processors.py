# coding: utf-8
from kobo.apps.open_rosa_server import koboform


def koboform_integration(request):
    return {
        'koboform_url': koboform.url,
        'koboform_autoredirect': koboform.autoredirect
    }
