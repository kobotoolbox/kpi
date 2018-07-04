# -*- coding: utf-8 -*-
from __future__ import absolute_import

from abc import ABCMeta, abstractmethod
from rest_framework import status

from .hook_log import HookLog


class ServiceDefinitionInterface(object):

    __metaclass__ = ABCMeta

    @classmethod
    @abstractmethod
    def parse(cls, uid, data):
        """
        Parsed the data before sending it.
        Useful when retrieving stringified JSON and parse as JSON.

        Should return
        {
            <export_type>: <value>,
            "uuid": uid
        }
        :param data: mixed
        :return: dict
        """
        pass

    @classmethod
    @abstractmethod
    def send(cls, hook, data):
        pass

    @staticmethod
    def save_log(hook, data_uid, status_code, message):
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

        log.success = status_code in [status.HTTP_201_CREATED, status.HTTP_200_OK]
        log.status_code = status_code
        log.message = message

        try:
            log.save()
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("ServiceDefinitionInterface.save_log - {}".format(str(e)), exc_info=True)
