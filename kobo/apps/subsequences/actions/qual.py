from kobo.apps.subsequences.actions.base import BaseAction


class BaseQualAction(BaseAction):
    KNOWN_PARAM_KEYS = ['uuid', 'labels', 'options', 'choices', 'type']
    # Confusing: "deleted" actually means "hidden", we don't delete QA questions
    # TODO: make "hidden" its own field and remove this option
    DELETED_OPTION = 'deleted'
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
                'manual_qual': {
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

        # For now, allow answers to all questions that can receive responses,
        # even if they are hidden
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

    def get_output_fields(self) -> list[dict]:
        output_fields = []
        for qual_item in self.params:
            field = {
                'label': qual_item['labels']['_default'],
                'source': self.source_question_xpath,
                'name': f"{self.source_question_xpath}/{qual_item['uuid']}",
                'type': qual_item['type'],
                'dtpath': f"{self.source_question_xpath}/{qual_item['uuid']}",
            }

            if qual_item['type'] in ('qualSelectOne', 'qualSelectMultiple'):
                field['choices'] = [
                    {
                        'uuid': choice['uuid'],
                        'labels': choice['labels'],
                    }
                    for choice in qual_item.get('choices', [])
                ]
            output_fields.append(field)
        return output_fields

    def update_params(self, incoming_params):
        """
        Merge incoming QA questions with existing ones
        """
        self.validate_params(incoming_params)
        new_questions_by_uuid = {x['uuid']: x for x in incoming_params}
        new_choices_by_uuid = {}
        for new_question in incoming_params:
            if choices := new_question.get('choices'):
                for choice in choices:
                    new_choices_by_uuid[choice['uuid']] = choice
        for existing_question in self.params:
            # old question is not in list of new questions, hide ("delete") it and
            # put it at the end
            uuid = existing_question['uuid']
            if not (new_question := new_questions_by_uuid.get(uuid)):
                existing_question.setdefault('options', {})[self.DELETED_OPTION] = True
                incoming_params.append(existing_question)
                continue
            new_type = new_question['type']
            old_type = existing_question['type']
            # do not allow changing the type of a question, for that is silly
            if new_type != old_type:
                raise ValidationError(
                    f'Cannot change type of existing question with uuid {uuid}'
                    f' from {old_type} to {new_type}'
                )

            # merge choices if necessary
            old_choices = existing_question.get('choices', [])
            for old_choice in old_choices:
                choice_uuid = old_choice['uuid']
                if new_choices_by_uuid.get(choice_uuid) is None:
                    old_choice.setdefault('options', {})[self.DELETED_OPTION] = True
                    # new question really should have 'choices' set by virtue of
                    # the json schema but better safe than sorry
                    new_question.setdefault('choices', []).append(old_choice)
        self.params = incoming_params
