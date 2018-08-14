# -*- coding: utf-8 -*-
from __future__ import absolute_import

import json
import logging

from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"json"

    def _parse(self, data, id):
        return {
            "json": data,
            "id": id
        }

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/json"},
            "json": self._data.get("json")
        }