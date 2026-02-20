import json
import os
import re
from abc import ABCMeta, abstractmethod

import constance
import requests
from django.db import transaction
from rest_framework import status
from ssrf_protect.ssrf_protect import SSRFProtect, SSRFProtectException

from kpi.utils.log import logging
from kpi.utils.strings import split_lines_to_list
from ..constants import KOBO_INTERNAL_ERROR_STATUS_CODE, RETRIABLE_STATUS_CODES
from ..exceptions import HookRemoteServerDownError
from .hook import Hook
from .hook_log import HookLog, HookLogStatus


class ServiceDefinitionInterface(metaclass=ABCMeta):

    def __init__(self, hook, submission_id):
        self._hook = hook
        self._submission_id = submission_id

        # Only fetch data if hook is active;
        # send() returns false immediately without processing if inactive.
        if self.hook.active:
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
                exc_info=True,
            )
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

    def send(self) -> bool:
        """
        Sends data to external endpoint.

        Raise an exception if something is wrong. Retries are only allowed
        when `HookRemoteServerDownError` is raised.
        """

        if not self._hook.active:
            logging.error(
                'service_json.ServiceDefinition.send: '
                f'Hook #{self._hook.uid} is not active, '
                f'stop procession Submission #{self._submission_id}'
            )
            return False

        # TODO consider changing "logging.info"  to "logging.debug" when
        #   DEV-1762 is reviewed & merged.

        logging.info(
            'service_json.ServiceDefinition.send: '
            f'Starting hook submission processing - Hook #{self._hook.uid} - '
            f'Submission #{self._submission_id}'
        )
        if not self._data:
            logging.info(
                'service_json.ServiceDefinition.send: '
                f'Submission data not found - Hook #{self._hook.uid} - '
                f'Submission #{self._submission_id}'
            )
            self.save_log(
                status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
                message='Submission has been deleted',
                log_status=HookLogStatus.FAILED,
            )
            return False

        logging.info(
            f'service_json.ServiceDefinition.send: '
            f'Preparing to send hook submission - Hook #{self._hook.uid} - '
            f'Submission #{self._submission_id}'
        )

        # Need to declare response before requests.post assignment in case of
        # RequestException
        response = None

        request_kwargs = self._prepare_request_kwargs()

        # Add custom headers
        request_kwargs.get('headers').update(
            self._hook.settings.get('custom_headers', {})
        )

        # Add user agent
        public_domain = (
            '- {} '.format(os.getenv('PUBLIC_DOMAIN_NAME'))
            if os.getenv('PUBLIC_DOMAIN_NAME')
            else ''
        )
        request_kwargs.get('headers').update(
            {
                'User-Agent': 'KoboToolbox external service {}#{}'.format(
                    public_domain, self._hook.uid
                )
            }
        )

        # If the request needs basic authentication with username and
        # password, let's provide them
        if self._hook.auth_level == Hook.BASIC_AUTH:
            request_kwargs.update(
                {
                    'auth': (
                        self._hook.settings.get('username'),
                        self._hook.settings.get('password'),
                    )
                }
            )

        ssrf_protect_options = {}
        if constance.config.SSRF_ALLOWED_IP_ADDRESS.strip():
            ssrf_protect_options['allowed_ip_addresses'] = split_lines_to_list(
                constance.config.SSRF_ALLOWED_IP_ADDRESS
            )

        if constance.config.SSRF_DENIED_IP_ADDRESS.strip():
            ssrf_protect_options['denied_ip_addresses'] = split_lines_to_list(
                constance.config.SSRF_DENIED_IP_ADDRESS
            )

        # Update the status to PROCESSING to indicate the Celery task has begun
        # execution. This distinguishes it from the initial PENDING state created in
        # call_services() before the task was scheduled, confirming the task was
        # successfully dequeued and is actively running.
        self.save_log(
            status_code=status.HTTP_102_PROCESSING,
            message='Submission is being queued for processing',
        )

        status_code = KOBO_INTERNAL_ERROR_STATUS_CODE
        message = ''
        log_status = HookLogStatus.FAILED

        try:
            SSRFProtect.validate(self._hook.endpoint, options=ssrf_protect_options)
            response = requests.post(self._hook.endpoint, timeout=30, **request_kwargs)
            response.raise_for_status()
            status_code = response.status_code
            message = response.text
            log_status = HookLogStatus.SUCCESS
            return True
        except requests.exceptions.RequestException as e:
            # If the request fails to communicate with remote server.
            # Exception is raised before request.post can return something.
            # Thus, response equals None
            message = str(e)

            if response is not None:
                message = response.text
                status_code = response.status_code
            elif 'Read timed out' in message:
                status_code = status.HTTP_504_GATEWAY_TIMEOUT

            if status_code in RETRIABLE_STATUS_CODES:
                log_status = HookLogStatus.PENDING
                raise HookRemoteServerDownError from e

            raise
        except SSRFProtectException as e:
            logging.error(
                'service_json.ServiceDefinition.send: '
                f'Hook #{self._hook.uid} - '
                f'Data #{self._submission_id} - '
                f'{str(e)}',
                exc_info=True,
            )
            message = f'{self._hook.endpoint} is not allowed'
            raise
        except (Exception, SystemExit) as e:
            logging.error(
                'service_json.ServiceDefinition.send: '
                f'Hook #{self._hook.uid} - '
                f'Data #{self._submission_id} - '
                f'{str(e)}',
                exc_info=True,
            )
            message = (
                f'An error occurred when sending data to external '
                f'endpoint: {str(e)}'
            )
            raise
        finally:
            logging.info(
                'service_json.ServiceDefinition.send: '
                f'Hook submission result - Hook #{self._hook.uid} - '
                f'Submission #{self._submission_id} - '
                f'Status: {status_code} - '
                f'Log Status: {log_status.name}'
            )
            self.save_log(
                log_status=log_status,
                status_code=status_code,
                message=message,
            )

    def save_log(
        self,
        status_code: int,
        message: str,
        log_status: int = HookLogStatus.PENDING,
    ):
        """
        Updates/creates log entry atomically
        """

        # Clean up message first
        try:
            json.loads(message)
        except TypeError:
            message = ''
        except ValueError:
            message = re.sub(r'<[^>]*>', ' ', message).strip()

        try:
            with transaction.atomic():
                # Use select_for_update to lock the row
                log, created = HookLog.objects.select_for_update().get_or_create(
                    hook=self._hook,
                    submission_id=self._submission_id,
                    defaults={'status_code': status_code, 'message': message},
                )

                if not (
                    status_code == status.HTTP_102_PROCESSING
                    and log_status == HookLogStatus.PENDING
                ):
                    log.tries += 1

                # Now update with actual values based on the current state
                log.status = log_status

                if log.status == HookLogStatus.PENDING and (
                    # +1 because the first attempt is not a retry
                    log.tries
                    > constance.config.HOOK_MAX_RETRIES + 1
                ):
                    log.status = HookLogStatus.FAILED

                log.status_code = status_code
                log.message = message
                log.save()

        except Exception as e:
            logging.error(
                f'ServiceDefinitionInterface.save_log - {str(e)}',
                exc_info=True,
            )
