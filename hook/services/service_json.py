# -*- coding: utf-8 -*-
import json
import logging

from celery import shared_task
import requests
from rest_framework import status

from hook.models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"json"

    @classmethod
    def parse(cls, uid, data):
        return {
            "json": json.loads(data),
            "uuid": uid
        }

    @classmethod
    def send(cls, hook, data):
        """

        :param hook: Hook
        :param data: dict
        :return: bool
        """

        success = False
        headers = {"Content-Type": "application/json"}
        submission_uuid = None

        try:
            submission_json = data.get("json")
            submission_uuid = data.get("uuid")
            # Add custom headers
            headers.update(hook.settings.get("custom_headers", {}))

            # Prepares `requests` parameters
            requests_kwargs = {
                "headers": headers,
                "json": submission_json
            }

            # If the request needs basic authentication with username & password,
            # let's provide them
            if hook.settings.get("username"):
                requests_kwargs.update({
                    "auth": (hook.settings.get("username"),
                             hook.settings.get("password"))
                })
            response = requests.post(hook.endpoint, **requests_kwargs)
            cls.save_log(hook, submission_uuid, response.status_code, response.text)
        except Exception as e:
            logger = logging.getLogger("console_logger")
            logger.error("service_json.ServiceDefinition.send - Submission #{} - {}".format(
                submission_uuid, str(e)), exc_info=True)
            cls.save_log(
                hook,
                submission_uuid,
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "An error occurred when sending data to external endpoint")

        return success