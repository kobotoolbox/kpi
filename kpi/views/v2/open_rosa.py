# coding: utf-8
from datetime import datetime

import pytz
from django.conf import settings
from django.utils.decorators import classonlymethod


class OpenRosaViewSetMixin:

    @classonlymethod
    def as_view(cls, actions=None, **initkwargs):
        """
        Allow `trailing_slash` as an argument of `action()` DRF decorator.
        Useful to override behaviour of `trailing_slash` argument passed to
        `kpi.urls.router_api_v2.OptionalSlashRouter()` to create routes
        without trailing slashes
        """
        cls.trailing_slash = None
        return super().as_view(actions=actions, **initkwargs)

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
