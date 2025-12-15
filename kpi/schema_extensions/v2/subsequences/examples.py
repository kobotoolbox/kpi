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
            request_only=True,
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
            'Qualitative Analysis - Simple Types',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                            'es': 'Resultado de análisis cualitativo',
                        },
                    },
                ],
            },
            description=(
                '`<question_type>` can be any of:'
                '\n\n'
                '* `qualText` \n'
                '* `qualInteger` \n'
                '* `qualTags` \n'
                '* `qualNote` \n'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Single Choice Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Urgency Level',
                            'es': 'Nivel de Urgencia',
                        },
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'High',
                                    'fr': 'Élevé',
                                    'es': 'Alto',
                                },
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Medium',
                                    'fr': 'Moyen',
                                    'es': 'Medio',
                                },
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Low',
                                    'fr': 'Bas',
                                    'es': 'Bajo',
                                },
                            },
                        ],
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Multiple Choice Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'choices': [
                            {
                                'uuid': 'xxxxxxxx-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Shelter', 'ar': 'مأوى'},
                            },
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food', 'ar': 'طعام'},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical', 'ar': 'طبي'},
                            },
                        ],
                    },
                ],
            },
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
            'Qualitative Analysis - Simple Types',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': '<question_type>',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Qualitative analysis result',
                            'es': 'Resultado de análisis cualitativo',
                        },
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            description=(
                '`<question_type>` can be any of:'
                '\n\n'
                '* `qualText` \n'
                '* `qualInteger` \n'
                '* `qualTags` \n'
                '* `qualNote` \n'
            ),
            response_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Single Choice Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectOne',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Urgency Level',
                            'es': 'Nivel de Urgencia',
                        },
                        'choices': [
                            {
                                'uuid': 'qqqqqqqq-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'High',
                                    'fr': 'Élevé',
                                    'es': 'Alto',
                                },
                            },
                            {
                                'uuid': 'hhhhhhhh-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Medium',
                                    'fr': 'Moyen',
                                    'es': 'Medio',
                                },
                            },
                            {
                                'uuid': 'gggggggg-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {
                                    '_default': 'Low',
                                    'fr': 'Bas',
                                    'es': 'Bajo',
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
            'Qualitative Analysis - Multiple Choice Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualSelectMultiple',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Tags'},
                        'choices': [
                            {
                                'uuid': 'xxxxxxxx-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Shelter', 'ar': 'مأوى'},
                            },
                            {
                                'uuid': 'zzzzzzzz-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Food', 'ar': 'طعام'},
                            },
                            {
                                'uuid': 'yyyyyyyy-bbbb-cccc-dddd-eeeeffffffff',
                                'labels': {'_default': 'Medical', 'ar': 'طبي'},
                            },
                        ],
                    },
                ],
                'uid': 'qa123456789AbCdEfGhIjklm',
            },
            response_only=True,
        ),
    ]
