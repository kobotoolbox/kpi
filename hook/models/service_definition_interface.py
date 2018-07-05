# -*- coding: utf-8 -*-
from __future__ import absolute_import

from abc import ABCMeta, abstractmethod
import logging
import requests
from rest_framework import status

from .hook_log import HookLog


class ServiceDefinitionInterface(object):

    __metaclass__ = ABCMeta

    def __init__(self, hook, data, uid=None):
        self._hook = hook
        self._data = data if uid is None else self._parse(data, uid)

    @abstractmethod
    def _parse(self, data, uid):
        """
        Parses the data to be compliant with the payload `kc` is sending
        when it receives data from `enketo`.

        Should return
        {
            <export_type>: <value>,
            "uid": uid
        }

        For example
        {
            "json": data,
            "uid": uid
        }
        :return: dict
        """
        pass

    @abstractmethod
    def _prepare_request_kwargs(self):
        """
        Prepares params to pass to `Requests.post` in `send` method.
        It defines headers and data.

        For example:
            {
                "headers": {"Content-Type": "application/json"},
                "json": self._data.get("json")
            }
        :return: dict
        """
        pass

    def send(self):
        """
        Sends data to external endpoint
        :return: bool
        """

        success = False

        try:
            request_kwargs = self._prepare_request_kwargs()

            # Add custom headers
            request_kwargs.get("headers").update(self._hook.settings.get("custom_headers", {}))

            # If the request needs basic authentication with username & password,
            # let's provide them
            if self._hook.settings.get("username"):
                request_kwargs.update({
                    "auth": (self._hook.settings.get("username"),
                             self._hook.settings.get("password"))
                })
            response = requests.post(self._hook.endpoint, timeout=30, **request_kwargs)
            success = response.status_code in [status.HTTP_201_CREATED, status.HTTP_200_OK]
            self.save_log(success, response.status_code, response.text)
        except requests.exceptions.Timeout as e:
            self.save_log(
                False,
                status.HTTP_408_REQUEST_TIMEOUT,
                str(e))
        except requests.exceptions.RequestException as e:
            self.save_log(
                False,
                status.HTTP_400_BAD_REQUEST,
                str(e))
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("service_json.ServiceDefinition.send - Submission #{} - {}".format(
                self._data.get("uid"), str(e)), exc_info=True)
            self.save_log(
                False,
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "An error occurred when sending data to external endpoint")

        return success

    def save_log(self, success, status_code, message):
        """
        Updates/creates log entry

        :param success: bool.
        :param status_code: int. HTTP status code
        :param message: str.
        """
        try:
            log = HookLog.objects.get(uid=self._data.get("uid"))
        except HookLog.DoesNotExist:
            log = HookLog(uid=self._data.get("uid"),
                          hook=self._hook,
                          instance_id=self._data.get("id"))

        log.success = success
        log.status_code = status_code
        log.message = message

        try:
            log.save()
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("ServiceDefinitionInterface.save_log - {}".format(str(e)), exc_info=True)

