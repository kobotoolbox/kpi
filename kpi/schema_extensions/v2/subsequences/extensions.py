from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import ResolvedComponent, build_array_type

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA


class SubsequenceParamsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureParamsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        action_refs = self._get_action_refs(auto_schema.registry)
        return build_array_type(schema={'anyOf': action_refs})

    @classmethod
    def _get_action_refs(cls, registry):
        nlp_component = ResolvedComponent(
            name='NLPActionParams',
            schema=cls._get_nlp_params_schema(),
            type=ResolvedComponent.SCHEMA,
            object=dict,
        )
        registry.register_on_missing(nlp_component)
        qual_component = ResolvedComponent(
            name='NLPActionParams',
            schema=cls._get_qual_params_schema(),
            type=ResolvedComponent.SCHEMA,
            object=dict,
        )
        registry.register_on_missing(qual_component)

        return [
            nlp_component.ref,
            qual_component.ref,
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

    @classmethod
    def _get_qual_params_schema(cls):
        defs = cls._get_qual_defs()
        return {
            'type': 'array',
            'items': defs['qualQuestion'],
        }

    @classmethod
    def _get_qual_defs(cls):
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
        definitions['qualQuestion'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': definitions['qualUuid'],
                'type': definitions['qualQuestionType'],
                'labels': definitions['qualLabels'],
                'choices': {
                    'type': 'array',
                    'items': definitions['qualChoice'],
                },
                'options': {'type': 'object'},
            },
            'required': ['uuid', 'type', 'labels'],
        }

        return definitions
