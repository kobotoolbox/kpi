# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

import hashlib

from django.utils.six.moves.urllib.parse import urlencode

from kpi.utils.future import hashable_str


def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        hashlib.md5(hashable_str(email.lower())).hexdigest(),
        urlencode({'s': '40'}),
        )
