# -*- coding: utf-8 -*-
from __future__ import absolute_import

from abc import ABCMeta, abstractmethod

from .hook_log import HookLog


class ServiceDefinitionInterface(object):

    __metaclass__ = ABCMeta

    @classmethod
    @abstractmethod
    def send(cls, hook, data=None):
        pass

    @staticmethod
    def save_log(hook, data_uid, success, status_code, message):
        """
        Updates/creates log entry

        :param hook: Hook. parent model. FK
        :param data_uid: str. 36 characters alphanumerical string
        :param success: bool.
        :param status_code: int. HTTP status code
        :param message: str.
        """
        try:
            log = HookLog.objects.get(uid=data_uid)
        except HookLog.DoesNotExist:
            log = HookLog(uid=data_uid, hook=hook)

        log.success = success
        log.status_code = status_code
        log.message = message

        try:
            log.save()
        except Exception as e:
            logging.error("ServiceDefinitionInterface.save_log - {}".format(str(e)), exc_info=True)