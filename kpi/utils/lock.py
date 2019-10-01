# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import os
from functools import wraps

import redis
from django.conf import settings


REDIS_LOCK_CLIENT = redis.Redis(**settings.LOCK_REDIS)


def lock(key='', timeout=None):

    def _lock(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            ret_value = None
            have_lock = False
            prefix = os.getenv('REDIS_KPI_LOCK_PREFIX', 'kpi-lock')
            key_ = '{}:{}'.format(prefix, key)
            lock_ = REDIS_LOCK_CLIENT.lock(key_, timeout=timeout)
            try:
                have_lock = lock_.acquire(blocking=False)
                if have_lock:
                    ret_value = func(*args, **kwargs)
            finally:
                if have_lock:
                    lock_.release()

            return ret_value
        return wrapper
    return _lock
