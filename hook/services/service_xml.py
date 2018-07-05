# -*- coding: utf-8 -*-
import requests

from hook.models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"xml"

    def _parse(self, uid, data):
        return {
            "data": data,
            "uid": uid
        }

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/json"},
            "json": self._data.get("json")
        }

