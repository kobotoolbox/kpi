from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA
from kpi.utils.schema_extensions.mixins import ComponentRegistrationMixin
from .schema import SELECT_QUESTION_TYPE_ENUM, SIMPLE_QUESTION_TYPE_ENUM


class SubsequenceParamsFieldExtension(
    ComponentRegistrationMixin, OpenApiSerializerFieldExtension
):

    def map_serializer_field(self, auto_schema, direction):
        action_refs = self._get_action_refs(auto_schema)
        return build_array_type(schema={'anyOf': action_refs})

    def _get_action_refs(self, auto_schema):
        nlp_component_ref = self._register_schema_component(
            auto_schema, f'{self.prefix}NLPActionParams', self._get_nlp_params_schema()
        )
        manual_qual_component_ref = self._register_schema_component(
            auto_schema,
            f'{self.prefix}ManualQualActionParams',
            self._get_manual_qual_params_schema(auto_schema),
        )
        automatic_qual_component_ref = self._register_schema_component(
            auto_schema,
            f'{self.prefix}AutomaticQualActionParams',
            self._get_automatic_qual_params_schema(auto_schema)
        )

        return [
            nlp_component_ref,
            manual_qual_component_ref,
            automatic_qual_component_ref,
        ]

    def _get_automatic_qual_params_schema(self, auto_schema):
        defs = self._get_qual_defs()
        return {
            'type': 'object',
            'properties': {
                'uuid': defs['qualUuid'],
            },
            'additionalProperties': False,
            'required': ['uuid'],
        }

    def _get_manual_qual_params_schema(self, auto_schema):
        defs = self._get_qual_defs()
        return {
            'anyOf': [
                self._register_schema_component(
                    auto_schema,
                    f'{self.prefix}QualSimpleQuestionParams',
                    defs['qualSimpleQuestion'],
                ),
                self._register_schema_component(
                    auto_schema,
                    f'{self.prefix}QualSelectQuestionParams',
                    defs['qualSelectQuestion'],
                ),
            ]
        }

    def _get_nlp_params_schema(self):
        return {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': GENERIC_STRING_SCHEMA,
            },
            'required': ['language'],
        }

    def _get_qual_defs(self):
        definitions = {
            'qualLabels': {
                'type': 'object',
                'properties': {
                    '_default': {'type': 'string'},
                },
                'additionalProperties': {'type': 'string'},
                'required': ['_default'],
            },
            'qualQuestionType': {
                'type': 'string',
                'enum': SIMPLE_QUESTION_TYPE_ENUM + SELECT_QUESTION_TYPE_ENUM,
            },
            'qualSimpleQuestionType': {
                'type': 'string',
                'enum': SIMPLE_QUESTION_TYPE_ENUM,
            },
            'qualSelectQuestionType': {
                'type': 'string',
                'enum': SELECT_QUESTION_TYPE_ENUM,
            },
            'qualUuid': {'type': 'string', 'format': 'uuid'},
        }
        definitions['qualChoice'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'labels': definitions['qualLabels'],
                'uuid': definitions['qualUuid'],
                'options': {
                    'type': 'object',
                    'properties': {'deleted': {'type': 'boolean'}},
                },
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
                'options': {
                    'type': 'object',
                    'properties': {'deleted': {'type': 'boolean'}},
                },
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
                'options': {
                    'type': 'object',
                    'properties': {'deleted': {'type': 'boolean'}},
                },
            },
            'required': ['uuid', 'type', 'labels', 'choices'],
        }

        return definitions


class SubsequenceResponseParamsFieldExtension(SubsequenceParamsFieldExtension):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureResponseParamsField'  # noqa
    prefix = 'Response'


class SubsequenceCreateResponseParamsFieldExtension(SubsequenceParamsFieldExtension):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureCreateResponseParamsField'  # noqa
    prefix = 'CreateResponse'

    def _get_qual_defs(self):
        defs = super()._get_qual_defs()
        fields_to_update = ['qualChoice', 'qualSimpleQuestion', 'qualSelectQuestion']
        for field in fields_to_update:
            del defs[field]['properties']['options']
        return defs


class SubsequenceRequestParamsFieldExtension(SubsequenceParamsFieldExtension):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureRequestParamsField'  # noqa
    prefix = 'Request'

    def _get_qual_defs(self):
        defs = super()._get_qual_defs()
        fields_to_update = ['qualChoice', 'qualSimpleQuestion', 'qualSelectQuestion']
        for field in fields_to_update:
            del defs[field]['properties']['options']
        return defs
