# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

import os
import re

from django.core.exceptions import ImproperlyConfigured


class RedisHelper(object):
    """
    Redis's helper.

    Mimics dj_database_url

    """

    @staticmethod
    def config(default=None):
        """
        Parses `REDIS_SESSION_URL` environment variable to return a dict with
        expected attributes for django redis session.

        :return: dict
        """

        redis_connection_url = os.getenv('REDIS_SESSION_URL', default)
        match = re.match(r'redis://(:(?P<password>[^@]*)@)?(?P<host>[^:]+):(?P<port>\d+)(/(?P<index>\d+))?',
                        redis_connection_url)
        if not match:
            raise ImproperlyConfigured("Could not parse Redis session URL. "
                                       "Please verify 'REDIS_SESSION_URL' value")

        redis_connection_dict = {
            'host': match.group('host'),
            'port': match.group('port'),
            'db': match.group('index') or 0,
            'password': match.group('password'),
            'prefix': os.getenv('REDIS_SESSION_PREFIX', 'session'),
            'socket_timeout': os.getenv('REDIS_SESSION_SOCKET_TIMEOUT', 1),
        }
        return redis_connection_dict
