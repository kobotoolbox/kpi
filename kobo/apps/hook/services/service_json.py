# -*- coding: utf-8 -*-
from __future__ import absolute_import

import json
import re

from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"json"

    def _parse_data(self, submission, fields):
        if len(fields) > 0:
            parsed_submission = {}
            submission_keys = submission.keys()

            for field_ in fields:
                pattern = r"^{}$" if "/" in field_ else r"(^|/){}(/|$)"
                for key_ in submission_keys:
                    if re.search(pattern.format(field_), key_):
                        parsed_submission.update({
                            key_: submission[key_]
                        })

            return parsed_submission

        return submission

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/json"},
            "json": self._data
        }