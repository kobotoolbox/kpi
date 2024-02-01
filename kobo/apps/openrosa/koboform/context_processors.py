# coding: utf-8
from kobo.apps.openrosa import koboform


def koboform_integration(request):
    return {
        'koboform_url': koboform.url,
        'koboform_autoredirect': koboform.autoredirect
    }
