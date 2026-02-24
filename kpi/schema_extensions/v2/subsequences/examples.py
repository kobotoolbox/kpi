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
            'Manual Qualitative Analysis - Deleted question',
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
