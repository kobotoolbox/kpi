from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import ResolvedComponent, build_array_type

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA
from kpi.utils.schema_extensions.mixins import ComponentRegistrationMixin


class SubsequenceParamsFieldExtension(
    ComponentRegistrationMixin, OpenApiSerializerFieldExtension
):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureParamsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        action_refs = self._get_action_refs(auto_schema)
        return build_array_type(schema={'anyOf': action_refs})

    def _get_action_refs(self, auto_schema):
        nlp_component_ref = self._register_schema_component(
            auto_schema, 'NLPActionParams', self._get_nlp_params_schema()
        )
        qual_component_ref = self._register_schema_component(
            auto_schema, 'QualActionParams', self._get_qual_params_schema(auto_schema)
        )

        return [
            nlp_component_ref,
            qual_component_ref,
        ]

    @classmethod
    def _get_nlp_params_schema(cls):
        return {
            'type': 'array',
            'items': {
                'additionalProperties': False,
                'properties': {
                    'language': GENERIC_STRING_SCHEMA,
                },
                'required': ['language'],
                'type': 'object',
            },
        }

    def _get_qual_params_schema(self, auto_schema):
        defs = self._get_qual_defs()
        return {
            'type': 'array',
            'items': {
                'anyOf': [
                    self._register_schema_component(auto_schema, 'QualSimpleQuestionParams', defs['qualSimpleQuestion']),
                    self._register_schema_component(auto_schema, 'QualSelectQuestionParams', defs['qualSelectQuestion']),
                ]
            },
        }

    def _get_qual_defs(self):
        definitions = {
            'qualLabels': {
                'type': 'object',
                'additionalProperties': {'type': 'string'},
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
            'qualSimpleQuestionType': {
                'type': 'string',
                'enum': [
                    'qualInteger',
                    'qualTags',
                    'qualText',
                    'qualNote',
                ],
            },
            'qualSelectQuestionType': {
                'type': 'string',
                'enum': [
                    'qualSelectMultiple',
                    'qualSelectOne',
                ],
            },
            'qualUuid': {'type': 'string', 'format': 'uuid'},
        }
        definitions['qualChoice'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'labels': definitions['qualLabels'],
                'uuid': definitions['qualUuid'],
                'options': {'type': 'object'},
            },
            'required': ['labels', 'uuid'],
        }
        definitions['qualSimpleQuestion'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': definitions['qualUuid'],
                'type': definitions['qualSimpleQuestionType'],
                'labels': definitions['qualLabels'],
                'options': {'type': 'object'},
            },
            'required': ['uuid', 'type', 'labels'],
        }
        definitions['qualSelectQuestion'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': definitions['qualUuid'],
                'type': definitions['qualSelectQuestionType'],
                'labels': definitions['qualLabels'],
                'choices': {
                    'type': 'array',
                    'items': definitions['qualChoice'],
                },
                'options': {'type': 'object'},
            },
            'required': ['uuid', 'type', 'labels', 'choices'],
        }

        return definitions
