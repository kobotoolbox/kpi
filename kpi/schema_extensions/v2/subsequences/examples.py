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
                'question_xpath': 'q1_audio',
                'submission_uuids': [
                    '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                    '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                ],
                'params': {
                    'language': 'en',
                    'locale': 'en-US',
                },
            },
            description=(
                'Starts Google transcription for the selected audio question '
                'across the listed submissions. `locale` is optional.'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Bulk translation job',
            value={
                'action_id': 'automatic_google_translation',
                'question_xpath': 'q1_transcript',
                'submission_uuids': [
                    '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                    '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                ],
                'params': {
                    'language': 'fr',
                },
            },
            description=(
                'Starts Google translation for the selected question across '
                'the listed submissions. `language` is the target language.'
            ),
            request_only=True,
        ),
    ]


def _bulk_action_response_value(
    *,
    action_id: str,
    cancelled: bool = False,
) -> dict:
    if action_id == 'automatic_google_transcription':
        question_xpath = 'q1_audio'
        params = {'language': 'en', 'locale': 'en-US'}
    else:
        question_xpath = 'q1_transcript'
        params = {'language': 'fr'}

    submission_uuids = [
        '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
        '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
    ]
    submission_statuses = [
        {
            'uuid': '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
            'status': 'complete',
        },
        {
            'uuid': '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
            'status': 'in_progress',
        },
    ]
    status = 'in_progress'
    progress = 50
    cancelled_by = None

    if cancelled:
        status = 'cancelled'
        progress = 100
        cancelled_by = {'username': 'someuser'}
        submission_uuids.append('5d4958d6-b2e8-4d4b-a51f-63f91b459e26')
        submission_statuses = [
            {
                'uuid': '3c3f8e07-d660-4f5d-bb0d-7f7a54f02f8f',
                'status': 'complete',
            },
            {
                'uuid': '0ca3624a-6f22-451e-8d0a-c40978fd6fe2',
                'status': 'cancelled',
            },
            {
                'uuid': '5d4958d6-b2e8-4d4b-a51f-63f91b459e26',
                'status': 'cancelled',
            },
        ]

    return {
        'uid': 'ba123456789AbCdEfGhIjklm',
        'status': status,
        'action_id': action_id,
        'question_xpath': question_xpath,
        'submission_uuids': submission_uuids,
        'submission_statuses': submission_statuses,
        'params': params,
        'progress': progress,
        'created_by': {
            'username': 'someuser',
        },
        'date_created': '2026-05-05T09:00:00Z',
        'date_modified': '2026-05-05T09:02:00Z',
        'cancelled_by': cancelled_by,
    }


def get_bulk_action_response_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Bulk transcription job response',
            value=_bulk_action_response_value(
                action_id='automatic_google_transcription',
            ),
            description=(
                'Bulk transcription responses include the action params used '
                'to start the job. `locale` appears when it was supplied.'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Bulk translation job response',
            value=_bulk_action_response_value(
                action_id='automatic_google_translation',
            ),
            description=(
                'Bulk translation responses use the same job shape. '
                '`params.language` is the target translation language.'
            ),
            response_only=True,
        ),
    ]


def get_bulk_action_list_response_examples() -> list[OpenApiExample]:
    transcription_response = _bulk_action_response_value(
        action_id='automatic_google_transcription',
    )
    translation_response = _bulk_action_response_value(
        action_id='automatic_google_translation',
    )
    return [
        OpenApiExample(
            'Bulk transcription job list response',
            value={
                'count': 1,
                'next': None,
                'previous': None,
                'results': [transcription_response],
            },
            response_only=True,
        ),
        OpenApiExample(
            'Bulk translation job list response',
            value={
                'count': 1,
                'next': None,
                'previous': None,
                'results': [translation_response],
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
        OpenApiExample(
            'Cancelled bulk transcription job response',
            value=_bulk_action_response_value(
                action_id='automatic_google_transcription',
                cancelled=True,
            ),
            description=(
                'The cancelled response shows active child items moved to '
                '`cancelled`; terminal child items remain unchanged.'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Cancelled bulk translation job response',
            value=_bulk_action_response_value(
                action_id='automatic_google_translation',
                cancelled=True,
            ),
            description=(
                'The cancelled response includes the user who cancelled the '
                'job in `cancelled_by`.'
            ),
            response_only=True,
        ),
    ]
