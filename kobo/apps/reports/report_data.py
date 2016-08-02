# coding: utf-8
from __future__ import unicode_literals

from django.conf import settings

import os
import json


def data(asset, kuids, lang=None, fields=None, split_by=None):
    with open(os.path.join(settings.BASE_DIR, 'temporary_data.json'), 'r') as ff:
        content = json.loads(ff.read())
    return content
