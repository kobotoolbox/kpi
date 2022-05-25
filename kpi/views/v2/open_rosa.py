# coding: utf-8
from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings


class OpenRosaViewSetMixin:

    @staticmethod
    def get_headers():
        dt = datetime.now(tz=ZoneInfo('UTC')).strftime('%a, %d %b %Y %H:%M:%S %Z')

        return {
            'Date': dt,
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Accept-Content-Length': settings.OPEN_ROSA_DEFAULT_CONTENT_LENGTH,
            'Content-Type': 'text/xml; charset=utf-8',
        }
