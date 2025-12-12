from drf_spectacular.utils import OpenApiExample


def get_advanced_features_create_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Manual Transcription',
            value={
                'action': 'manual_transcription',
                'question_xpath': 'q1',
                'params': [
                    {'language': 'es'},
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manual Translation',
            value={
                'action': 'manual_translation',
                'question_xpath': 'q1',
                'params': [
                    {'language': 'es'},
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Automatic Google Transcription',
            value={
                'action': 'automatic_google_transcription',
                'question_xpath': 'q1',
                'params': [
                    {'language': 'es'},
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Text Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualText',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {'_default': 'Summary'},
                    },
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis - Integer Question',
            value={
                'action': 'qual',
                'question_xpath': 'q1',
                'params': [
                    {
                        'type': 'qualInteger',
                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                        'labels': {
                            '_default': 'Number of themes',
                            'fr': 'Nombre de thèmes',
                        },
                    },
                ],
            },
            request_only=True,
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
            'Manual Translation',
            value=[
                {
                    'action': 'manual_translation',
                    'question_xpath': 'q1',
                    'params': [
                        {'language': 'es'},
                    ],
                    'uid': 'qa123456789AbCdEfGhIjklm',
                },
            ],
            response_only=True,
        ),
        OpenApiExample(
            'Automatic Google Transcription',
            value=[
                {
                    'action': 'automatic_google_transcription',
                    'question_xpath': 'q1',
                    'params': [
                        {'language': 'es'},
                    ],
                    'uid': 'qa123456789AbCdEfGhIjklm',
                },
            ],
            response_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis',
            value=[
                {
                    'action': 'qual',
                    'question_xpath': 'q1',
                    'params': [
                        {
                            'type': 'qualText',
                            'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                            'labels': {'_default': 'Summary'},
                        },
                    ],
                    'uid': 'qa123456789AbCdEfGhIjklm',
                },
                {
                    'action': 'qual',
                    'question_xpath': 'q1',
                    'params': [
                        {
                            'type': 'qualInteger',
                            'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                            'labels': {
                                '_default': 'Number of themes',
                                'fr': 'Nombre de thèmes',
                            },
                        },
                    ],
                    'uid': 'qa123456789AbCdEfGhIjklm',
                },
                {
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
                {
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
            ],
            response_only=True,
        ),
    ]


def get_advanced_features_update_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Change Action Parameters',
            value={
                'params': [
                    {'language': 'es'},
                ],
            },
            request_only=True,
        ),
        OpenApiExample(
            'Change Writable Fields',
            value={
                'action': 'automatic_google_translation',
                'question_xpath': 'q2',
                'params': [
                    {'language': 'fr'},
                ],
            },
            request_only=True,
        ),
    ]
