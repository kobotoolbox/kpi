from unittest import TestCase

import jsonschema
import pytest
from ddt import data, ddt, unpack

from kobo.apps.subsequences.actions.automatic_chained_qual import (
    AutomaticChainedQualAction,
)


@ddt
class TestAutomaticChainedQual(TestCase):
    @data(
        # type, main label, choice label, should pass?
        ('qualInteger', 'How many?', None, True),
        ('qualInteger', 'How many?', 'This should not be here', False),
        ('qualInteger', None, None, False),
        ('qualText', 'Why?', None, True),
        ('qualText', 'Why?', 'This should not be here', False),
        ('qualText', None, None, False),
        ('qualNote', 'Note', None, True),
        ('qualNote', 'Note', 'This should not be here', False),
        ('qualNote', None, None, False),
        ('qualSelectOne', 'Select one', None, False),
        ('qualSelectOne', 'Select one', 'Choice A', True),
        ('qualSelectOne', None, 'Choice A', False),
        ('qualSelectMultiple', 'Select many', None, False),
        ('qualSelectMultiple', 'Select many', 'Choice A', True),
        ('qualSelectMultiple', None, 'Choice A', False),
        ('qualTags', 'Tag', None, True),
        ('qualTags', 'Tag', 'Choice A', False),
        ('qualTags', None, None, False),
        ('badType', 'label', None, False),
        (None, 'label', None, False),
    )
    @unpack
    def test_valid_params(self, type, main_label, choice_label, should_pass):
        main_uuid = 'main_uuid'
        choice_uuid = 'choice_uuid'
        param = {'uuid': main_uuid}
        if type:
            param['type'] = type
        if main_label:
            param['labels'] = {'_default': main_label}
        if choice_label:
            param['choices'] = [
                {'uuid': choice_uuid, 'labels': {'_default': choice_label}}
            ]
        if should_pass:
            AutomaticChainedQualAction.validate_params([param])
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                AutomaticChainedQualAction.validate_params([param])

    def test_data_schema(self):
        pass

    def test_valid_user_data(self):
        pass

    def test_invalid_user_data(self):
        pass

    def test_external_data_schema(self):
        pass

    def test_valid_external_data(self):
        pass

    def test_invalid_external_data(self):
        pass

    def test_get_output_fields(self):
        pass

    def test_transform_data_for_output(self):
        pass
