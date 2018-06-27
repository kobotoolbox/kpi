# -*- coding: utf-8 -*-
import json
import logging

from celery import shared_task
import requests
from rest_framework import status

from hook.models import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"json"

    @classmethod
    def send(cls, hook, data):

        success = False
        headers = {"Content-Type": "application/json"}
        submission_uuid = None

        try:
            submission_json = data.get("json")
            submission_uuid = data.get("uuid")
            response = requests.post(hook.endpoint, headers=headers, json=submission_json)
            success = response.status_code in [status.HTTP_201_CREATED, status.HTTP_200_OK]
            cls.save_log(hook, submission_uuid, response.status_code, response.text)
        except Exception as e:
            logging.error("service_json.ServiceDefinition.send - Submission #{} - {}".format(
                submission_uuid, str(e)), exc_info=True)
            cls.save_log(
                hook,
                submission_uuid,
                500,
                "An error occurred when sending data to external endpoint")

        return success