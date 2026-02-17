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
            'Qualitative Analysis - Simple Types',
            value={
                'action': '<action_id>',
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
                '`<question_type>` may be either `qualText` or `qualInteger`:'
                '\n\n'
                '`<action_id>` may be either `manual_qual` or `automatic_bedrock_qual`'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Simple Types - Manual Only',
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
            description='`<question_type>` may be either `qualTags` or `qualNote`',
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Single Choice Question',
            value={
                'action': '<action_id>',
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
            description='`<action_id>` may be either `manual_qual` '
            'or `automatic_bedrock_qual`',
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Multiple Choice Question',
            value={
                'action': '<action_id>',
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
            description='`<action_id>` may be either `manual_qual` '
            'or `automatic_bedrock_qual`',
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
            'Qualitative Analysis - Simple Types ',
            value={
                'action': '<action_id>',
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
                '`<question_type>` may be either `qualText` or `qualInteger`'
                '\n\n'
                '`<action_id>` may be either `manual_qual` or `automatic_bedrock_qual`'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Simple Types - Manual Only',
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
            description='`<question_type>` may be either `qualNote` or `qualTags`',
            response_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Single Choice Question',
            value={
                'action': '<action_id>',
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
            description='`<action_id>` may be either `manual_qual`'
            ' or `automatic_bedrock_qual`',
        ),
        OpenApiExample(
            'Qualitative Analysis - Multiple Choice Question (with deleted choice)',
            value={
                'action': '<action_id>',
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
            description='`<action_id>` may be either'
            ' `manual_qual` or `automatic_bedrock_qual`',
        ),
        OpenApiExample(
            'Qualitative Analysis - Deleted question',
            value={
                'action': '<action_id>',
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
            description='`<action_id>` may be either `manual_qual`'
            ' or `automatic_bedrock_qual`',
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
            'Qualitative Analysis - Simple Types',
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
                '`<question_type>` may be either `qualText` or `qualInteger`'
                '\n\n'
                'This may be used to update either `manual_qual`'
                ' or `automatic_bedrock_qual` actions'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Simple Types - Manual Only',
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
            description='`<question_type>` may be either `qualTags` or `qualNote`',
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Single Choice Question',
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
            description=(
                'This may be used to update either `manual_qual`'
                ' or `automatic_bedrock_qual` actions'
            ),
        ),
        OpenApiExample(
            'Qualitative Analysis - Multiple Choice Question',
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
            description=(
                'This may be used to update either `manual_qual`'
                ' or `automatic_bedrock_qual` actions'
            ),
        ),
    ]
