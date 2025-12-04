from copy import deepcopy
from unittest import mock
import uuid

from freezegun import freeze_time
import dateutil
import jsonschema
import pytest

from ..actions.qual import QualAction
from .constants import EMPTY_SUBMISSION


class Fix:
    """
    This class houses things that should probably be moved to a fixture
    - - -
    TODO: do we want `_dateAccepted` here?
    TODO: forbid deletion of questions and choices
    TODO: be a lot more diligent about deepcopying, e.g. in `def data_schema()`

    DECISION: discard `type`s from response data. Even pre-refactor, we already
        had stuff like this (confirmed on Global):
            {
                'val': '81c5c592-9c3f-4220-b7fc-ea1d758b6535',
                'type': 'qual_select_one',
                'uuid': '8ce9be67-ae6a-4eca-b1e5-2a9f7ac51341',
            }
        What benefit is `type` really adding here? If we lose track of the
        `8ce9be67…` question, we're hosed anyway
    """

    # Action configuration

    fake_question_xpath = 'group_name/question_name'  # irrelevant in tests
    action_params = [
        {
            'type': 'qualInteger',
            'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
            'labels': {'_default': 'How many characters appear in the story?'},
        },
        {
            'type': 'qualSelectMultiple',
            'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
            'labels': {'_default': "What themes were present in the story?"},
            'choices': [
                {
                    'uuid': '2e24e6b4-bc3b-4e8e-b0cd-d8d3b9ca15b6',
                    'labels': {'_default': 'Empathy'},
                },
                {
                    'uuid': 'cb82919d-2948-4ccf-a488-359c5d5ee53a',
                    'labels': {'_default': 'Competition'},
                },
                {
                    'uuid': '8effe3b1-619e-4ada-be45-ebcea5af0aaf',
                    'labels': {'_default': 'Apathy'},
                },
            ],
        },
        {
            'type': 'qualSelectOne',
            'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
            'labels': {'_default': 'Was this a first-hand account?'},
            'choices': [
                {
                    'uuid': '3c7aacdc-8971-482a-9528-68e64730fc99',
                    'labels': {'_default': 'Yes'},
                },
                {
                    'uuid': '7e31c6a5-5eac-464c-970c-62c383546a94',
                    'labels': {'_default': 'No'},
                },
            ],
        },
        {
            'type': 'qualTags',
            'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
            'labels': {'_default': 'Tag any landmarks mentioned in the story'},
        },
        {
            'type': 'qualText',
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            'labels': {'_default': 'Add any further remarks'},
        },
        {
            'type': 'qualNote',
            'uuid': '5ef11d48-d7a3-432e-af83-8c2e9b1feb72',
            'labels': {'_default': 'Thanks for your diligence'},
        },
    ]

    # Data-related schemas

    expected_data_schema = {
        '$defs': {
            # TODO: use `'format': 'uuid'` and move to global?
            'qualUuid': {'type': 'string', 'minLength': 1},
            'qualCommon': {
                'type': 'object',
                'additionalProperties': False,
                'properties': {
                    'uuid': {'$ref': '#/$defs/qualUuid'},
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
            'qualSelectMultiple': {
                'type': 'object',
                'properties': {
                    'value': {
                        'type': 'array',
                        'items': {'type': 'string', 'minLength': 1},
                    },
                },
            },
            'qualSelectOne': {
                'type': 'object',
                'properties': {
                    'value': {'type': 'string'},
                },
            },
            'qualTags': {
                'type': 'object',
                'properties': {
                    'value': {'type': 'array', 'items': {'type': 'string'}},
                },
            },
            'qualText': {
                'type': 'object',
                'properties': {
                    'value': {'type': 'string'},
                },
            },
        },
        'oneOf': [
            {
                'allOf': [
                    {'$ref': '#/$defs/qualCommon'},
                    {'$ref': '#/$defs/qualInteger'},
                    {
                        'type': 'object',
                        'properties': {
                            'uuid': {
                                'const': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a'
                            }
                        },
                    },
                ]
            },
            {
                'allOf': [
                    {'$ref': '#/$defs/qualCommon'},
                    {'$ref': '#/$defs/qualSelectMultiple'},
                    {
                        'type': 'object',
                        'properties': {
                            'uuid': {
                                'const': '2e30bec7-4843-43c7-98bc-13114af230c5'
                            }
                        },
                    },
                ]
            },
            {
                'allOf': [
                    {'$ref': '#/$defs/qualCommon'},
                    {'$ref': '#/$defs/qualSelectOne'},
                    {
                        'type': 'object',
                        'properties': {
                            'uuid': {
                                'const': '1a8b748b-f470-4c40-bc09-ce2b1197f503'
                            }
                        },
                    },
                ]
            },
            {
                'allOf': [
                    {'$ref': '#/$defs/qualCommon'},
                    {'$ref': '#/$defs/qualTags'},
                    {
                        'type': 'object',
                        'properties': {
                            'uuid': {
                                'const': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f'
                            }
                        },
                    },
                ]
            },
            {
                'allOf': [
                    {'$ref': '#/$defs/qualCommon'},
                    {'$ref': '#/$defs/qualText'},
                    {
                        'type': 'object',
                        'properties': {
                            'uuid': {
                                'const': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad'
                            }
                        },
                    },
                ]
            },
        ],
    }
    expected_result_schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a': {
                '$ref': '#/$defs/dataActionKey'
            },
            '2e30bec7-4843-43c7-98bc-13114af230c5': {
                '$ref': '#/$defs/dataActionKey'
            },
            '1a8b748b-f470-4c40-bc09-ce2b1197f503': {
                '$ref': '#/$defs/dataActionKey'
            },
            'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f': {
                '$ref': '#/$defs/dataActionKey'
            },
            '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad': {
                '$ref': '#/$defs/dataActionKey'
            },
            '5ef11d48-d7a3-432e-af83-8c2e9b1feb72': {
                '$ref': '#/$defs/dataActionKey'
            },
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
            # Apologies for sacrificing clarity by not reproducing here the
            # entire schema unadulterated, but the length was getting out of
            # control
            'dataSchema': {
                # Un-nest definitions
                k: v
                for k, v in expected_data_schema.items()
                if k != '$defs'
            },
            **expected_data_schema['$defs'],
            'dateTime': {'type': 'string', 'format': 'date-time'},
            'uuid': {'type': 'string', 'format': 'uuid'},
        },
    }

    # Response data

    valid_filled_responses = [
        {
            'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
            # type is qualInteger
            'value': 3,
        },
        {
            'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
            # type is qualSelectMultiple
            'value': [
                '2e24e6b4-bc3b-4e8e-b0cd-d8d3b9ca15b6',
                'cb82919d-2948-4ccf-a488-359c5d5ee53a',
            ],
        },
        {
            'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
            # type is qualSelectOne
            'value': '7e31c6a5-5eac-464c-970c-62c383546a94',
        },
        {
            'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
            # type is qualTags
            'value': ['Quinobequin', 'Doughboy Donuts'],
        },
        {
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            # type is qualText
            'value': 'As the eagle and the wild goose see it',
        },
    ]
    valid_empty_responses = [
        {
            'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
            # type is qualInteger
            'value': None,
        },
        {
            'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
            # type is qualSelectMultiple
            'value': [],
        },
        {
            'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
            # type is qualSelectOne
            'value': '',
        },
        {
            'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
            # type is qualTags
            'value': [],
        },
        {
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            # type is qualText
            'value': '',
        },
    ]
    invalid_responses = [
        'garbage',
        {
            # type is qualText
            'value': 'missing uuid!',
        },
        {
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            # type is qualText
            # missing value!
        },
        {
            'uuid': '5ef11d48-d7a3-432e-af83-8c2e9b1feb72',
            # type is qualNote
            'value': 'unexpected response!',  # notes take no responses
        },
        {
            'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
            # type is qualInteger
            'value': 'not an integer',
        },
        {
            'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
            # type is qualSelectMultiple
            'value': 'not an array',
        },
        {
            'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
            # type is qualSelectOne
            'value': ['unexpected array'],
        },
        {
            'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
            # type is qualTags
            'value': 'not an array',
        },
        {
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            # type is qualText
            'value': ['unexpected array'],
        },
        {
            'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
            'type': 'qualText',
            'value': 'the type is not to be included as an attribute',
        },
    ]

    # Results, including multiple versions of responses

    result_mock_timestamp_sequence = [
        '2025-01-01T11:11:11Z',
        '2025-01-02T11:11:11Z',
        '2025-02-01T11:11:11Z',
        '2025-02-02T11:11:11Z',
        '2025-03-01T11:11:11Z',
        '2025-03-02T11:11:11Z',
        '2025-04-01T11:11:11Z',
        '2025-04-02T11:11:11Z',
        '2025-05-01T11:11:11Z',
        '2025-05-02T11:11:11Z',
    ]
    result_mock_uuid_sequence = [
        'a9a817c0-7208-4063-bab6-93c0a3a7615b',
        '61d23cd7-ce2c-467b-ab26-0839226c714d',
        '20dd5185-ee43-451f-8759-2f5185c3c912',
        '409c690e-d148-4d80-8c73-51be941b33b0',
        '49fbd509-e042-44ce-843c-db04485a0096',
        '5799f662-76d7-49ab-9a1c-ae2c7d502a78',
        'c4fa8263-50c0-4252-9c9b-216ca338be13',
        '64e59cc1-adaf-47a3-a068-550854d8f98f',
        '909c62cf-d544-4926-8839-7f035c6c7483',
        '15ccc864-0e83-48f2-be1d-dc2adb9297f4',
    ]
    expected_result_after_filled_and_empty_responses = {
        '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a': {
            '_dateCreated': '2025-01-01T11:11:11Z',
            '_dateModified': '2025-01-02T11:11:11Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
                        'value': None,  # Empty response recorded last
                    },
                    '_dateCreated': '2025-01-02T11:11:11Z',
                    '_dateAccepted': '2025-01-02T11:11:11Z',
                    '_uuid': '61d23cd7-ce2c-467b-ab26-0839226c714d',
                },
                {
                    '_data': {
                        'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
                        'value': 3,  # Filled response recorded first
                    },
                    '_dateCreated': '2025-01-01T11:11:11Z',
                    '_dateAccepted': '2025-01-01T11:11:11Z',
                    '_uuid': 'a9a817c0-7208-4063-bab6-93c0a3a7615b',
                },
            ],
        },
        '2e30bec7-4843-43c7-98bc-13114af230c5': {
            '_dateCreated': '2025-02-01T11:11:11Z',
            '_dateModified': '2025-02-02T11:11:11Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
                        'value': [],
                    },
                    '_dateCreated': '2025-02-02T11:11:11Z',
                    '_dateAccepted': '2025-02-02T11:11:11Z',
                    '_uuid': '409c690e-d148-4d80-8c73-51be941b33b0',
                },
                {
                    '_data': {
                        'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
                        'value': [
                            '2e24e6b4-bc3b-4e8e-b0cd-d8d3b9ca15b6',
                            'cb82919d-2948-4ccf-a488-359c5d5ee53a',
                        ],
                    },
                    '_dateCreated': '2025-02-01T11:11:11Z',
                    '_dateAccepted': '2025-02-01T11:11:11Z',
                    '_uuid': '20dd5185-ee43-451f-8759-2f5185c3c912',
                },
            ],
        },
        '1a8b748b-f470-4c40-bc09-ce2b1197f503': {
            '_dateCreated': '2025-03-01T11:11:11Z',
            '_dateModified': '2025-03-02T11:11:11Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
                        'value': '',
                    },
                    '_dateCreated': '2025-03-02T11:11:11Z',
                    '_dateAccepted': '2025-03-02T11:11:11Z',
                    '_uuid': '5799f662-76d7-49ab-9a1c-ae2c7d502a78',
                },
                {
                    '_data': {
                        'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
                        'value': '7e31c6a5-5eac-464c-970c-62c383546a94',
                    },
                    '_dateCreated': '2025-03-01T11:11:11Z',
                    '_dateAccepted': '2025-03-01T11:11:11Z',
                    '_uuid': '49fbd509-e042-44ce-843c-db04485a0096',
                },
            ],
        },
        'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f': {
            '_dateCreated': '2025-04-01T11:11:11Z',
            '_dateModified': '2025-04-02T11:11:11Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
                        'value': [],
                    },
                    '_dateCreated': '2025-04-02T11:11:11Z',
                    '_dateAccepted': '2025-04-02T11:11:11Z',
                    '_uuid': '64e59cc1-adaf-47a3-a068-550854d8f98f',
                },
                {
                    '_data': {
                        'uuid': 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f',
                        'value': ['Quinobequin', 'Doughboy Donuts'],
                    },
                    '_dateCreated': '2025-04-01T11:11:11Z',
                    '_dateAccepted': '2025-04-01T11:11:11Z',
                    '_uuid': 'c4fa8263-50c0-4252-9c9b-216ca338be13',
                },
            ],
        },
        '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad': {
            '_dateCreated': '2025-05-01T11:11:11Z',
            '_dateModified': '2025-05-02T11:11:11Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
                        'value': '',
                    },
                    '_dateCreated': '2025-05-02T11:11:11Z',
                    '_dateAccepted': '2025-05-02T11:11:11Z',
                    '_uuid': '15ccc864-0e83-48f2-be1d-dc2adb9297f4',
                },
                {
                    '_data': {
                        'uuid': '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad',
                        'value': 'As the eagle and the wild goose see it',
                    },
                    '_dateCreated': '2025-05-01T11:11:11Z',
                    '_dateAccepted': '2025-05-01T11:11:11Z',
                    '_uuid': '909c62cf-d544-4926-8839-7f035c6c7483',
                },
            ],
        },
    }


_action = QualAction(
    source_question_xpath=Fix.fake_question_xpath, params=Fix.action_params
)


def test_param_validation():
    invalid_params = [
        {
            'type': 'qualSelectMultiple',
            'uuid': '2e30bec7-4843-43c7-98bc-13114af230c5',
            'labels': {'_default': "What themes were present in the story?"},
            # Oops, no choices!
        }
    ]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        # Instantiation must validate params
        QualAction(
            source_question_xpath=Fix.fake_question_xpath, params=invalid_params
        )


def test_data_schema_generation():
    generated_schema = _action.data_schema
    assert generated_schema == Fix.expected_data_schema


def test_valid_filled_responses_pass_data_validation():
    for response in Fix.valid_filled_responses:
        _action.validate_data(response)


def test_valid_empty_responses_pass_data_validation():
    for response in Fix.valid_empty_responses:
        _action.validate_data(response)


def test_invalid_reponses_fail_data_validation():
    for response in Fix.invalid_responses:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            _action.validate_data(response)


def test_result_schema_generation():
    generated_schema = _action.result_schema
    assert generated_schema == Fix.expected_result_schema


def test_valid_result_passes_validation():
    _action.validate_result(
        Fix.expected_result_after_filled_and_empty_responses
    )


def test_invalid_result_fails_validation():
    working_result = deepcopy(
        Fix.expected_result_after_filled_and_empty_responses
    )

    # erroneously add '_dateModified' onto a version
    first_version = working_result['1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a'][
        '_versions'
    ][0]
    first_version['_dateModified'] = first_version['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        _action.validate_result(working_result)


def test_result_content():
    """
    For each question specified in `Fix.action_params`, record two responses:
    1. First, the corresponding response from `Fix.valid_filled_responses`
    2. Then, the empty response from `Fix.valid_empty_responses`

    Afterwards, verify the result against
    `Fix.expected_result_after_filled_and_empty_responses`
    """

    # Sanity check the fixture data, since this test requires both the filled
    # and empty response lists each to have one response per question
    # (identified by its UUID) in the same order
    filled_uuids = [x['uuid'] for x in Fix.valid_filled_responses]
    empty_uuids = [x['uuid'] for x in Fix.valid_empty_responses]
    assert filled_uuids == empty_uuids

    datetime_iter = iter(
        (dateutil.parser.parse(dt) for dt in Fix.result_mock_timestamp_sequence)
    )
    uuid_list = [uuid.UUID(u) for u in Fix.result_mock_uuid_sequence]

    accumulated_result = {}

    with mock.patch('uuid.uuid4', side_effect=uuid_list):
        for filled_response, empty_response in zip(
            Fix.valid_filled_responses, Fix.valid_empty_responses
        ):
            for response in filled_response, empty_response:
                with freeze_time(next(datetime_iter)):
                    accumulated_result = _action.revise_data(
                        EMPTY_SUBMISSION, accumulated_result, response
                    )

    assert (
        accumulated_result
        == Fix.expected_result_after_filled_and_empty_responses
    )
