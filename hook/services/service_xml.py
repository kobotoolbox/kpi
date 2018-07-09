# -*- coding: utf-8 -*-
import requests

from hook.models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"xml"

    def _parse(self, data, id):
        return {
            "data": data,
            "id": id
        }

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/xml"},
            "data": self._data.get("xml")
        }

