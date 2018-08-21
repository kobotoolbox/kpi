# -*- coding: utf-8 -*-
from __future__ import absolute_import

from abc import ABCMeta, abstractmethod
import logging
import json
import re

import requests
from django.conf import settings
from rest_framework import status

from ..constants import HOOK_LOG_SUCCESS, HOOK_LOG_FAILED
from .hook_log import HookLog


class ServiceDefinitionInterface(object):

    __metaclass__ = ABCMeta

    def __init__(self, hook, uuid):
        self._hook = hook
        self._uuid = uuid
        self._data = self._get_data()

    def _get_data(self):
        """
        Retrieves data from deployment backend of the asset.
        """
        try:
            return self._hook.asset.deployment.get_submission(self._uuid, self._hook.export_type)
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("service_json.ServiceDefinition._get_data - Hook #{} - Data #{} - {}".format(
                self._hook.uid, self._uuid, str(e)), exc_info=True)

        return None

    @abstractmethod
    def _prepare_request_kwargs(self):
        """
        Prepares params to pass to `Requests.post` in `send` method.
        It defines headers and data.

        For example:
            {
                "headers": {"Content-Type": "application/json"},
                "json": self._data
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
        if self._data:
            try:
                request_kwargs = self._prepare_request_kwargs()

                # Add custom headers
                request_kwargs.get("headers").update(self._hook.settings.get("custom_headers", {}))

                # Add user agent
                request_kwargs.get("headers").update({
                    "User-Agent": "KoBoToolbox external service #{}".format(self._hook.uid)
                })

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
                logger.error("service_json.ServiceDefinition.send - Hook #{} - Data #{} - {}".format(
                    self._hook.uid, self._uuid, str(e)), exc_info=True)
                self.save_log(
                    False,
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "An error occurred when sending data to external endpoint")
        else:
            self.save_log(
                False,
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "No data available")

        return success

    def save_log(self, success, status_code, message):
        """
        Updates/creates log entry

        :param success: bool.
        :param status_code: int. HTTP status code
        :param message: str.
        """
        fields = {
            "hook": self._hook,
            "instance_uuid": self._uuid
        }
        try:
            # Try to load the log with a multiple field FK because
            # we don't know the log `uid` in this context, but we do know
            # its `hook` FK and its `instance.id
            log = HookLog.objects.get(**fields)
        except HookLog.DoesNotExist:
            log = HookLog(**fields)

        if success:
            log.status = HOOK_LOG_SUCCESS
        elif log.tries > settings.HOOK_MAX_RETRIES:
            log.status = HOOK_LOG_FAILED

        log.status_code = status_code

        # Try to create a json object.
        # In case of failure, it should be HTML, we can remove tags
        try:
            json.loads(message)
        except ValueError as e:
            message = re.sub(r"<[^>]*>", " ", message).strip()

        log.message = message

        try:
            log.save()
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("ServiceDefinitionInterface.save_log - {}".format(str(e)), exc_info=True)
