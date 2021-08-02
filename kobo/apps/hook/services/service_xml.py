# coding: utf-8
from kpi.utils.xml import strip_nodes
from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = "xml"

    def _parse_data(self, submission, fields):
        return strip_nodes(submission, fields, xml_declaration=True)

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/xml"},
            "data": self._data
        }

