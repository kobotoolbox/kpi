from drf_spectacular.utils import OpenApiExample


def get_advanced_features_create_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'NLP Advanced Features',
            value={
                'action': '<action_id>',
                'question_xpath': 'q1',
                'params': [
                    {'language': 'es'},
                    {'language': 'fr'},
                ],
            },
            description=(
                '`<action_id>` can be any of:'
                '\n\n'
                '* `manual_transcription`\n'
                '* `manual_translation`\n'
                '* `automatic_google_transcription`\n'
                '* `automatic_google_translation`\n'
                ''
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Simple Types',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                        },
                    },
                ],
            },
            description=(
                '`<question_type>` may be any of:'
                '\n\n'
                '* `qualText`\n'
                '* `qualInteger`\n'
                '* `qualNote`\n'
                '* `qualTags`\n'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Single Choice Question',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Urgency Level',
                        },
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'High',
                                },
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Medium',
                                },
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Low',
                                },
                            },
                        ],
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Multiple Choice Question',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'choices': [
                            {
                                'uuid': 'xxxxxxxx-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Shelter'},
                            },
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food'},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical'},
                            },
                        ],
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Hints',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Favorite shade of blue?',
                        },
                        'hint': {'labels': {'_default': 'Select closest shade'}},
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Midnight',
                                },
                                'hint': {'labels': {'_default': 'Darkest blue'}},
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Royal',
                                },
                                'hint': {'labels': {'_default': 'True blue'}},
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Cornflower',
                                },
                                'hint': {'labels': {'_default': 'Lightest blue'}},
                            },
                        ],
                    },
                ],
            },
            request_only=True,
            description='Question hints are allowed for all types of questions. '
            'Choice hints are allowed for all questions with choices.',
        ),
        OpenApiExample(
            'Automatic Qualitative Analysis - Any Question',
            value={
                'action': 'automatic_bedrock_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                    },
                ],
            },
            description='`uuid`s should match those present in the `manual_qual`'
            ' action for the same survey question.',
            request_only=True,
        ),
    ]


def get_advanced_features_list_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'NLP Advanced Features',
            value={
                'action': '<action_id>',
                'question_xpath': 'q1',
                'params': [
                    {'language': 'es'},
                    {'language': 'en'},
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
            description=(
                '`<action_id>` can be any of:'
                '\n\n'
                '* `manual_transcription`\n'
                '* `manual_translation`\n'
                '* `automatic_google_transcription`\n'
                '* `automatic_google_translation`\n'
                ''
            ),
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Simple Types ',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                        },
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            description=(
                '`<question_type>` may be any of:'
                '\n\n'
                '* `qualText`\n'
                '* `qualInteger`\n'
                '* `qualNote`\n'
                '* `qualTags`\n'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Single Choice Question',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Urgency Level',
                        },
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'High',
                                },
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Medium',
                                },
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Low',
                                },
                            },
                        ],
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Multiple Choice Question '
            '(with deleted choice)',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'choices': [
                            {
                                'uuid': 'xxxxxxxx-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Shelter'},
                                'options': {'deleted': True},
                            },
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food'},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical'},
                            },
                        ],
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Deleted Question',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                        },
                    },
                ],
                'options': {'deleted': True},
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Question With Hints',
            value={
                'action': 'manual_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'hint': {'labels': {'_default': 'Select the most appropriate'}},
                        'choices': [
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food'},
                                'hint': {'labels': {'_default': 'Include water'}},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical'},
                                'hint': {'labels': {'_default': 'Include dental work'}},
                            },
                        ],
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Automatic Qualitative Analysis - Any question',
            value={
                'action': 'automatic_bedrock_qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
    ]


def get_advanced_features_update_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'NLP Advanced Features',
            value={
                'params': [
                    {'language': 'es'},
                    {'language': 'fr'},
                ],
            },
            description=(
                'This may be used to update any of the NLP actions:'
                '\n\n'
                '* `manual_transcription`\n'
                '* `manual_translation`\n'
                '* `automatic_google_transcription`\n'
                '* `automatic_google_translation`\n'
                ''
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Simple Types',
            value={
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                        },
                    },
                ],
            },
            description=(
                '`<question_type>` may be any of:'
                '\n\n'
                '* `qualText`\n'
                '* `qualInteger`\n'
                '* `qualNote`\n'
                '* `qualTags`\n'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Single Choice Question',
            value={
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Urgency Level',
                        },
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'High',
                                },
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Medium',
                                },
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Low',
                                },
                            },
                        ],
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manual Qualitative Analysis - Multiple Choice Question',
            value={
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'choices': [
                            {
                                'uuid': 'xxxxxxxx-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Shelter'},
                            },
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food'},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical'},
                            },
                        ],
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Automatic Qualitative Analysis - All Types',
            value={
                'params': [
                    {
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                    },
                    {
                        'uuid': 'dddddddd-eeee-ffff-gggg-hhhhhhhhhhhhh',
                    }
                ],
            },
            description='`uuid`s should match those present in the `manual_qual`'
                        ' action for the same survey question.',
            request_only=True,
        ),
    ]


def get_bulk_actions_create_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Bulk transcription job',
            value={
                'action_id': 'automatic_google_transcription',
                'question_xpath': 'q1',
                'submission_uuids': [
                    '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                    '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                ],
                'params': {
                    'language': 'en',
                    'locale': 'en-US',
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Bulk translation job',
            value={
                'action_id': 'automatic_google_translation',
                'question_xpath': 'q1',
                'submission_uuids': [
                    '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                    '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                ],
                'params': {
                    'language': 'fr',
                },
            },
            request_only=True,
        ),
    ]


def _bulk_action_response_value() -> dict:
    return {
        'uid': 'ba123456789AbCdEfGhIjklm',
        'status': 'in_progress',
        'action_id': 'automatic_google_transcription',
        'question_xpath': 'q1',
        'submission_uuids': [
            '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
            '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
        ],
        'submission_statuses': [
            {
                'uuid': '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                'status': 'complete',
            },
            {
                'uuid': '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                'status': 'in_progress',
            },
        ],
        'params': {
            'language': 'en',
            'locale': 'en-US',
        },
        'created_by': {
            'username': 'someuser',
        },
        'date_created': '2026-05-05T09:00:00Z',
        'date_modified': '2026-05-05T09:02:00Z',
        'cancelled_by': None,
    }


def get_bulk_action_response_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Bulk action response',
            value=_bulk_action_response_value(),
            response_only=True,
        ),
    ]


def get_bulk_action_list_response_examples() -> list[OpenApiExample]:
    response_value = _bulk_action_response_value()
    return [
        OpenApiExample(
            'Bulk action list response',
            value={
                'count': 1,
                'next': None,
                'previous': None,
                'results': [response_value],
            },
            response_only=True,
        ),
    ]


def get_bulk_action_patch_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Bulk action cancel request',
            value={
                'status': 'cancelled',
            },
            request_only=True,
        ),
        *get_bulk_action_response_examples(),
    ]
