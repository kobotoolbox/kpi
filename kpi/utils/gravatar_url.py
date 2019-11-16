# coding: utf-8
import hashlib
from urllib.parse import urlencode

from kpi.utils.strings import hashable_str


def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        hashlib.md5(hashable_str(email.lower())).hexdigest(),
        urlencode({'s': '40'}),
        )
