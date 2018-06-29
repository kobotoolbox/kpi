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
    def save_log(hook, data_uid, status_code, message):
        try:
            log = HookLog.objects.get(uid=data_uid)
        except HookLog.DoesNotExist:
            log = HookLog(uid=data_uid, hook=hook)

        log.status_code = status_code
        log.message = message

        try:
            log.save()
        except Exception as e:
            logging.error("ServiceDefinitionInterface.save_log - {}".format(str(e)))