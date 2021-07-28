# coding: utf-8
import json
import os
import re
from abc import ABCMeta, abstractmethod

import constance
import requests
from ssrf_protect.ssrf_protect import SSRFProtect, SSRFProtectException

from kpi.utils.log import logging
from .hook import Hook
from .hook_log import HookLog
from ..constants import (
    HOOK_LOG_SUCCESS,
    HOOK_LOG_FAILED,
    KOBO_INTERNAL_ERROR_STATUS_CODE,
)


class ServiceDefinitionInterface(metaclass=ABCMeta):

    def __init__(self, hook, submission_id):
        self._hook = hook
        self._submission_id = submission_id
        self._data = self._get_data()

    def _get_data(self):
        """
        Retrieves data from deployment backend of the asset.
        """
        try:
            submission = self._hook.asset.deployment.get_submission(
                self._submission_id,
                user=self._hook.asset.owner,
                format_type=self._hook.export_type,
            )
            return self._parse_data(submission, self._hook.subset_fields)
        except Exception as e:
            logging.error(
                'service_json.ServiceDefinition._get_data: '
                f'Hook #{self._hook.uid} - Data #{self._submission_id} - '
                f'{str(e)}',
                exc_info=True)
        return None

    @abstractmethod
    def _parse_data(self, submission, fields):
        """
        Data must be parsed to include only `self._hook.subset_fields` if there are any.
        :param submission: json|xml
        :param fields: list
        :return: mixed: json|xml
        """
        if len(fields) > 0:
            pass
        return submission

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
        # Need to declare response before requests.post assignment in case of
        # RequestException
        response = None
        if self._data:
            try:
                request_kwargs = self._prepare_request_kwargs()

                # Add custom headers
                request_kwargs.get("headers").update(
                    self._hook.settings.get("custom_headers", {}))

                # Add user agent
                public_domain = "- {} ".format(os.getenv("PUBLIC_DOMAIN_NAME")) \
                    if os.getenv("PUBLIC_DOMAIN_NAME") else ""
                request_kwargs.get("headers").update({
                    "User-Agent": "KoBoToolbox external service {}#{}".format(
                        public_domain,
                        self._hook.uid)
                })

                # If the request needs basic authentication with username and
                # password, let's provide them
                if self._hook.auth_level == Hook.BASIC_AUTH:
                    request_kwargs.update({
                        "auth": (self._hook.settings.get("username"),
                                 self._hook.settings.get("password"))
                    })

                ssrf_protect_options = {}
                if constance.config.SSRF_ALLOWED_IP_ADDRESS.strip():
                    ssrf_protect_options['allowed_ip_addresses'] = constance.\
                        config.SSRF_ALLOWED_IP_ADDRESS.strip().split('\r\n')

                if constance.config.SSRF_DENIED_IP_ADDRESS.strip():
                    ssrf_protect_options['denied_ip_addresses'] = constance.\
                        config.SSRF_DENIED_IP_ADDRESS.strip().split('\r\n')

                SSRFProtect.validate(self._hook.endpoint,
                                     options=ssrf_protect_options)

                response = requests.post(self._hook.endpoint, timeout=30,
                                         **request_kwargs)
                response.raise_for_status()
                self.save_log(response.status_code, response.text, True)
                success = True
            except requests.exceptions.RequestException as e:
                # If request fails to communicate with remote server.
                # Exception is raised before request.post can return something.
                # Thus, response equals None
                status_code = KOBO_INTERNAL_ERROR_STATUS_CODE
                text = str(e)
                if response is not None:
                    text = response.text
                    status_code = response.status_code
                self.save_log(status_code, text)
            except SSRFProtectException as e:
                logging.error(
                    'service_json.ServiceDefinition.send: '
                    f'Hook #{self._hook.uid} - '
                    f'Data #{self._submission_id} - '
                    f'{str(e)}',
                    exc_info=True)
                self.save_log(
                    KOBO_INTERNAL_ERROR_STATUS_CODE,
                    f'{self._hook.endpoint} is not allowed')
            except Exception as e:
                logging.error(
                    'service_json.ServiceDefinition.send: '
                    f'Hook #{self._hook.uid} - '
                    f'Data #{self._submission_id} - '
                    f'{str(e)}',
                    exc_info=True)
                self.save_log(
                    KOBO_INTERNAL_ERROR_STATUS_CODE,
                    "An error occurred when sending data to external endpoint")
        else:
            self.save_log(
                KOBO_INTERNAL_ERROR_STATUS_CODE,
                "No data available")

        return success

    def save_log(self, status_code: int, message: str, success: bool = False):
        """
        Updates/creates log entry with:
        - `status_code` as the HTTP status code of the remote server response
        - `message` as the content of the remote server response
        """
        fields = {
            'hook': self._hook,
            'submission_id': self._submission_id
        }
        try:
            # Try to load the log with a multiple field FK because
            # we don't know the log `uid` in this context, but we do know
            # its `hook` FK and its `submission_id`
            log = HookLog.objects.get(**fields)
        except HookLog.DoesNotExist:
            log = HookLog(**fields)

        if success:
            log.status = HOOK_LOG_SUCCESS
        elif log.tries >= constance.config.HOOK_MAX_RETRIES:
            log.status = HOOK_LOG_FAILED

        log.status_code = status_code

        # We want to clean up HTML, so first, we try to create a json object.
        # In case of failure, it should be HTML (or plaintext), we can remove
        # tags
        try:
            json.loads(message)
        except ValueError:
            message = re.sub(r"<[^>]*>", " ", message).strip()

        log.message = message

        try:
            log.save()
        except Exception as e:
            logging.error(
                f'ServiceDefinitionInterface.save_log - {str(e)}',
                exc_info=True,
            )
