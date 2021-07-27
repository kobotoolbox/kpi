# coding: utf-8
from urllib.parse import urlencode

from kpi.utils.hash import calculate_hash


def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        calculate_hash(email.lower()),
        urlencode({'s': '40'}),
        )
