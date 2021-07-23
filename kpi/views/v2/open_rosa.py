# coding: utf-8
from datetime import datetime

import pytz
from django.conf import settings


class OpenRosaViewSetMixin:

    @staticmethod
    def get_headers():
        tz = pytz.timezone(settings.TIME_ZONE)
        dt = datetime.now(tz).strftime('%a, %d %b %Y %H:%M:%S %Z')

        return {
            'Date': dt,
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Accept-Content-Length': settings.OPEN_ROSA_DEFAULT_CONTENT_LENGTH,
            'Content-Type': 'text/xml; charset=utf-8',
        }
