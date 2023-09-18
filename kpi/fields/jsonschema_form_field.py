import json

import jsonschema
from django.forms import ValidationError
from django.forms.fields import CharField
from django.utils.translation import gettext as t

from kobo.apps.constance_backends.utils import to_python_object


class JsonSchemaFormField(CharField):
    def __init__(self, *args, schema, **kwargs):
        self.schema = schema
        super().__init__(*args, **kwargs)

    def clean(self, value):
        try:
            instance = json.loads(value)
            jsonschema.validate(instance, self.schema)
        except json.JSONDecodeError as e:
            # Message written to match `IntegerField`, which uses the
            # imperative: "Enter a whole number."
            raise ValidationError(t('Enter valid JSON.') + ' ' + str(e))
        except jsonschema.exceptions.ValidationError as e:
            # `str(e)` is too verbose (it includes the entire schema)
            raise ValidationError(t('Enter valid JSON.') + ' ' + e.message)
        return value


class FreeTierThresholdField(JsonSchemaFormField):
    """
    Validates that the input has required properties with expected types
    """

    def __init__(self, *args, **kwargs):
        schema = {
            'type': 'object',
            'uniqueItems': True,
            'properties': {
                'storage': {'type': ['integer', 'null']},
                'data': {'type': ['integer', 'null']},
                'transcription_minutes': {'type': ['integer', 'null']},
                'translation_chars': {'type': ['integer', 'null']},
            },
            'required': [
                'storage',
                'data',
                'transcription_minutes',
                'translation_chars',
            ],
            'additionalProperties': False,
        }
        super().__init__(*args, schema=schema, **kwargs)


class FreeTierDisplayField(JsonSchemaFormField):
    """
    Validates that the input has required properties with expected types
    """

    def __init__(self, *args, **kwargs):
        schema = {
            'type': 'object',
            'uniqueItems': True,
            'properties': {
                'name': {'type': ['string', 'null']},
                'feature_list': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
            },
            'required': ['name', 'feature_list'],
            'additionalProperties': False,
        }
        super().__init__(*args, schema=schema, **kwargs)


class I18nTextJSONField(JsonSchemaFormField):
    """
    Validates that the input is an object which contains at least the 'default'
    key.
    """

    def __init__(self, *args, **kwargs):
        schema = {
            'type': 'object',
            'uniqueItems': True,
            'properties': {
                'default': {'type': 'string'},
            },
            'required': ['default'],
            'additionalProperties': True,
        }
        super().__init__(*args, schema=schema, **kwargs)


class MetadataFieldsListField(JsonSchemaFormField):
    """
    Validates that the input is an array of objects with "name" and "required"
    properties, e.g.
        [
            {
                "name": "important_field",
                "required": true,
                "label": {
                    "default": "Important Field",
                    "fr": "Champ important"
                }
            },
            {
                "name": "whatever_field",
                "required": false,
                "label": {
                    "default": "Whatever Field",
                    "fr": "Champ whatever"
                }
            },
            …
        ]
    """
    REQUIRED_FIELDS = []

    def __init__(self, *args, **kwargs):
        schema = {
            'type': 'array',
            'uniqueItems': True,
            'items': {
                'type': 'object',
                'required': ['name', 'required'],
                'additionalProperties': False,
                'properties': {
                    'name': {'type': 'string'},
                    'required': {'type': 'boolean'},
                    'label': {
                        'type': 'object',
                        'uniqueItems': True,
                        'properties': {
                            'default': {'type': 'string'},
                        },
                        'required': ['default'],
                        'additionalProperties': True,
                    }
                }
            }
        }
        super().__init__(*args, schema=schema, **kwargs)

    def clean(self, value):
        value = super().clean(value)

        if not self.REQUIRED_FIELDS:
            return value

        instance = to_python_object(value)

        if set(self.REQUIRED_FIELDS) - set(d['name'] for d in instance):
            raise ValidationError(
                t('`##place_holder##` field cannot be hidden.').replace(
                    '##place_holder##',
                    '`, `'.join(self.REQUIRED_FIELDS)
                )
            )
        return value


class UserMetadataFieldsListField(MetadataFieldsListField):

    REQUIRED_FIELDS = ['name']
