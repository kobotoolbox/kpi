# coding: utf-8
import json
import re

from ..constants import SUBMISSION_PLACEHOLDER
from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = 'json'

    def __add_payload_template(self, submission):
        if not self._hook.payload_template:
            return submission

        custom_payload = self._hook.payload_template.replace(
            SUBMISSION_PLACEHOLDER, json.dumps(submission))

        return json.loads(custom_payload)

    def _parse_data(self, submission, fields):

        if len(fields) > 0:
            parsed_submission = {}
            submission_keys = submission.keys()

            for field_ in fields:
                pattern = r'^{}$' if '/' in field_ else r'(^|/){}(/|$)'
                for key_ in submission_keys:
                    if re.search(pattern.format(field_), key_):
                        parsed_submission.update({
                            key_: submission[key_]
                        })

            return self.__add_payload_template(parsed_submission)

        return self.__add_payload_template(submission)

    def _prepare_request_kwargs(self):
        return {
            'headers': {'Content-Type': 'application/json'},
            'json': self._data
        }
