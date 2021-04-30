# coding: utf-8
from urllib.parse import urlencode

from kpi.utils.hash import get_hash


def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        get_hash(email.lower()),
        urlencode({'s': '40'}),
        )
