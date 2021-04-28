# -*- coding: utf-8 -*-
import logging

from threading import local

from django.contrib.auth.models import AnonymousUser

_thread_locals = local()
logger = logging.getLogger(__name__)


def set_current_request(request):
    """
    Binds the request to the current thread.

    :param request: Django request object
    :return:
    """
    logger.debug(u"Save request in current thread")
    return setattr(_thread_locals, '__django_userforeignkey__current_request', request)


def get_current_request():
    """
    Gets the request from the current thread.

    :return: Django request object
    """
    return getattr(_thread_locals, '__django_userforeignkey__current_request', None)


def get_current_user():
    """
    Gets the current user from the current request. In case there is no current
    request, or there is no user information attached to the request, an AnonymousUser object
    is returned.

    :return: User object
    """
    request = get_current_request()
    if not request or not hasattr(request, 'user'):
        return AnonymousUser()
    return request.user
