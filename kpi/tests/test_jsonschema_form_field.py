import json

import pytest
from django.forms import ValidationError

from kpi.fields.jsonschema_form_field import (
    I18nTextJSONField,
    MetadataFieldsListField,
    UserMetadataFieldsListField,
)

VALID_I18N = {'default': 'Hello', 'fr': 'Bonjour'}

VALID_METADATA_LIST = [
    {'name': 'name', 'required': True},
    {'name': 'email', 'required': False},
]


class TestI18nTextJSONFieldClean:

    def setup_method(self):
        self.field = I18nTextJSONField()

    def test_clean_dict_input_returns_dict(self):
        assert self.field.clean(VALID_I18N) == VALID_I18N

    def test_clean_json_string_returns_dict(self):
        assert self.field.clean(json.dumps(VALID_I18N)) == VALID_I18N

    def test_clean_invalid_json_raises(self):
        with pytest.raises(ValidationError):
            self.field.clean('{not valid json}')

    def test_clean_schema_violation_from_dict_raises(self):
        # 'default' key is required by the schema
        with pytest.raises(ValidationError):
            self.field.clean({'fr': 'Bonjour'})

    def test_clean_schema_violation_from_string_raises(self):
        with pytest.raises(ValidationError):
            self.field.clean(json.dumps({'fr': 'Bonjour'}))


class TestMetadataFieldsListFieldClean:

    def setup_method(self):
        self.field = MetadataFieldsListField()

    def test_clean_list_input_returns_list(self):
        assert self.field.clean(VALID_METADATA_LIST) == VALID_METADATA_LIST

    def test_clean_json_string_returns_list(self):
        assert self.field.clean(json.dumps(VALID_METADATA_LIST)) == VALID_METADATA_LIST

    def test_clean_invalid_json_raises(self):
        with pytest.raises(ValidationError):
            self.field.clean('[not valid json]')

    def test_clean_schema_violation_raises(self):
        # 'required' key is mandatory per the schema
        with pytest.raises(ValidationError):
            self.field.clean([{'name': 'username'}])


class TestUserMetadataFieldsListFieldClean:
    """
    UserMetadataFieldsListField.REQUIRED_FIELDS = ['name'], meaning an entry
    with name='name' must always be present in the list.
    """

    def setup_method(self):
        self.field = UserMetadataFieldsListField()

    def test_clean_list_with_required_field_passes(self):
        assert self.field.clean(VALID_METADATA_LIST) == VALID_METADATA_LIST

    def test_clean_json_string_with_required_field_passes(self):
        assert self.field.clean(json.dumps(VALID_METADATA_LIST)) == VALID_METADATA_LIST

    def test_clean_list_missing_required_field_raises(self):
        data = [{'name': 'email', 'required': False}]
        with pytest.raises(ValidationError):
            self.field.clean(data)

    def test_clean_json_string_missing_required_field_raises(self):
        data = [{'name': 'email', 'required': False}]
        with pytest.raises(ValidationError):
            self.field.clean(json.dumps(data))
