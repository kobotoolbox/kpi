import json

import jsonschema
from django.forms import ValidationError
from django.forms.fields import CharField
from django.utils.translation import gettext as t

from kpi.utils.json import LazyJSONEncoder


class JsonSchemaFormField(CharField):
    def __init__(self, *args, schema, **kwargs):
        self.schema = schema
        super().__init__(*args, **kwargs)

    def prepare_value(self, value):
        if isinstance(value, (dict, list)):
            return json.dumps(value, indent=2, cls=LazyJSONEncoder)
        return super().prepare_value(value)

    def clean(self, value):
        # Constance may pass an already-decoded Python object (dict/list) when
        # the DB value was stored correctly (e.g. via the lazy_json_serializable
        # codec). Accept it directly rather than round-tripping through JSON.
        if isinstance(value, (dict, list)):
            instance = value
        else:
            try:
                instance = json.loads(value)
            except json.JSONDecodeError as e:
                raise ValidationError(t('Enter valid JSON.') + ' ' + str(e))
        try:
            jsonschema.validate(instance, self.schema)
        except jsonschema.exceptions.ValidationError as e:
            # `str(e)` is too verbose (it includes the entire schema)
            raise ValidationError(t('Enter valid JSON.') + ' ' + e.message)
        # Must return the parsed object, not the raw string. Constance pickles
        # (3.x) or JSON-encodes (4.x) the return value directly — returning a
        # string here would store a string in the DB and cause TypeErrors when
        # the setting is later accessed as a dict/list.
        return instance


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
        # super().clean() returns a parsed list, never a raw string.
        value = super().clean(value)

        if not self.REQUIRED_FIELDS:
            return value

        # `value` is already a list here — do not call json.loads() on it.
        instance = value

        if set(self.REQUIRED_FIELDS) - set(d['name'] for d in instance):
            raise ValidationError(
                t('`##place_holder##` field cannot be hidden.').replace(
                    '##place_holder##',
                    '`, `'.join(self.REQUIRED_FIELDS)
                )
            )
        return instance


class UserMetadataFieldsListField(MetadataFieldsListField):

    REQUIRED_FIELDS = ['name']
