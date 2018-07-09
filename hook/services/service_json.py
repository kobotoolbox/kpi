# -*- coding: utf-8 -*-
import json
import logging

from hook.models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"json"

    def _parse(self, data, id):
        return {
            "json": json.loads(data),
            "id": id
        }

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/json"},
            "json": self._data.get("json")
        }