# -*- coding: utf-8 -*-
import requests

from hook.models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"xml"

    def send(self, data):
        instance = parsed_instance.instance
        headers = {"Content-Type": "application/xml"}
        response = requests.post(hook.endpoint, data=instance.xml, headers=headers)

