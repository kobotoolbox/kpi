from copy import deepcopy
from typing import Any

from .base import ActionClassConfig, BaseAction


class QualAction(BaseAction):

    ID = 'qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=False, action_data_key='uuid'
    )

    # JSON Schema definitions

    data_schema_definitions = {
        'qualCommon': {
            # Remember that JSON Schema is subtractive
            # These essential constraints are common to all qualitative
            # analysis question types
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': {'$ref': '#/$defs/qualUuid'},
                # `value` is further restricted by the schemas for each type
                'value': {},
            },
            'required': ['uuid', 'value'],
        },
        'qualInteger': {
            'type': 'object',
            'properties': {
                'value': {'type': ['integer', 'null']},
            },
        },
        'qualSelectOne': {
            'type': 'object',
            'properties': {
                'value': {'type': 'string'},
            },
        },
        'qualSelectMultiple': {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'array',
                    'items': {'type': 'string', 'minLength': 1},
                },
            },
        },
        'qualTags': {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
            },
        },
        'qualText': {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'string',
                },
            },
        },
    }
    params_schema_definitions = {
        'qualChoice': {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'labels': {'$ref': '#/$defs/qualLabels'},
                'uuid': {'$ref': '#/$defs/qualUuid'},
                'options': {'type': 'object'},
            },
            'required': ['labels', 'uuid'],
        },
        'qualLabels': {
            'type': 'object',
            'additionalProperties': False,
            'patternProperties': {'.+': {'type': 'string'}},
        },
        'qualQuestion': {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': {'$ref': '#/$defs/qualUuid'},
                'type': {'$ref': '#/$defs/qualQuestionType'},
                'labels': {'$ref': '#/$defs/qualLabels'},
                'choices': {
                    'type': 'array',
                    'items': {'$ref': '#/$defs/qualChoice'},
                },
                'options': {'type': 'object'},
            },
            'required': ['uuid', 'type', 'labels'],
            # Additionally require `choices` for the select types
            'if': {
                'properties': {
                    'type': {'$ref': '#/$defs/qualSelectQuestionType'},
                }
            },
            'then': {'required': ['choices']},
        },
        'qualQuestionType': {
            'type': 'string',
            'enum': [
                'qualInteger',
                'qualSelectMultiple',
                'qualSelectOne',
                'qualTags',
                'qualText',
                'qualNote',  # Takes no response data
            ],
        },
        'qualSelectQuestionType': {
            'type': 'string',
            'enum': [
                'qualSelectMultiple',
                'qualSelectOne',
            ],
        },
    }
    shared_definitions = {
        'qualUuid': {'type': 'string', 'minLength': 1},
    }

    # JSON Schemas

    params_schema = {
        'type': 'array',
        'items': {'$ref': '#/$defs/qualQuestion'},
        '$defs': {**shared_definitions, **params_schema_definitions},
    }

    @property
    def data_schema(self):
        """
        POST to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental/"
        {
            '_version': '20250820',
            'question_name_xpath': {
                'qual': {
                    'uuid': '24a68b0a-62fb-4122-8377-412810b2f45d',
                    'value': 'pithy text',
                }
            },
        }

        …gets processed by our caller into just:
        {
            'uuid': '24a68b0a-62fb-4122-8377-412810b2f45d',
            'value': 'pithy text',
        }

        …which is what the schema returned by this function needs to validate
        """
        schema = {
            '$defs': {
                **self.shared_definitions,
                'qualCommon': deepcopy(self.data_schema_definitions['qualCommon'])
            },
            'oneOf': [],
        }

        for qual_item in self.params:
            try:
                data_schema_def = self.data_schema_definitions[
                    qual_item['type']
                ]
            except KeyError:
                # Not all "question" types are allowed to receive responses
                continue

            schema['$defs'][qual_item['type']] = data_schema_def
            schema['oneOf'].append(
                # TODO: resolve
                #
                # Concerns:
                # 1. Is including only the schemas for types actually used in
                #    this asset's qualitative analysis form confusing?
                # 2. Does using the definitions to save on bloat in the schema
                #    result in error messages that are too confusing?
                #
                # Note: a "good" (?) thing is that the choices are not really
                # validated, so if we have allowed them to be deleted in the
                # past (which we probably have), at least validation won't blow
                # up for existing data

                {
                    'allOf': [
                        {'$ref': '#/$defs/qualCommon'},
                        {'$ref': '#/$defs/' + qual_item['type']},
                        {
                            'type': 'object',
                            'properties': {
                                'uuid': {'const': qual_item['uuid']}
                            },
                        },
                    ],
                }
            )

        return schema

    @property
    def result_schema(self):
        data_schema = deepcopy(self.data_schema)
        data_schema_definitions = data_schema.pop('$defs')
        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                # Every question gets a property in the results
                # TODO: Does `dataActionKey` make sense as a name?
                qual_item['uuid']: {'$ref': '#/$defs/dataActionKey'}
                for qual_item in self.params
            },
            '$defs': {
                'dataActionKey': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        '_versions': {
                            'type': 'array',
                            'minItems': 1,
                            'items': {
                                'type': 'object',
                                'additionalProperties': False,
                                'properties': {
                                    '_data': {'$ref': '#/$defs/dataSchema'},
                                    '_dateCreated': {'$ref': '#/$defs/dateTime'},
                                    '_dateAccepted': {'$ref': '#/$defs/dateTime'},
                                    '_uuid': {'$ref': '#/$defs/uuid'},
                                },
                                'required': ['_data', '_dateCreated', '_uuid'],
                            },
                        },
                        '_dateCreated': {'$ref': '#/$defs/dateTime'},
                        '_dateModified': {'$ref': '#/$defs/dateTime'},
                    },
                    'required': ['_dateCreated', '_dateModified'],
                },
                'dataSchema': data_schema,
                **data_schema_definitions,
                # FIXME: This junk should be in some global place
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'uuid': {'type': 'string', 'format': 'uuid'},
                ###
            },
        }
        return schema

    def get_output_fields(self):
        return []

    def transform_data_for_output(
        self, action_data: list[dict]
    ) -> dict[str, dict[str, Any]]:
        return []
