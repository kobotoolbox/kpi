# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

import hashlib
import urllib

from kpi.utils.future import hashable_str


def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        hashlib.md5(hashable_str(email.lower())).hexdigest(),
        urllib.urlencode({'s': '40'}),
        )
