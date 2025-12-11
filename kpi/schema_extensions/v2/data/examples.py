from drf_spectacular.utils import OpenApiExample


def get_data_supplement_examples() -> list[OpenApiExample]:
    """
    Return all OpenApiExample objects used to document the Data Supplement
    endpoint. Includes both request-only and response-only examples.

    Request examples cover each valid branch of the `anyOf` payload:
      - manual_transcription
      - manual_translation
      - automated_google_transcription
      - automated_google_translation
      - all 5 Qualitative Analysis variants:
        - integer
        - text
        - tags
        - select_one
        - select_multiple

    Response examples provide the corresponding server-side structures for the
    same cases. Each example is explicitly marked as request_only or response_only
    to avoid overriding content types and to ensure Swagger displays them in the
    correct sections.
    """

    return (
        _get_data_supplement_patch_payload_request_examples()
        + _get_data_supplement_response_examples()
    )


def _get_data_supplement_patch_payload_request_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Manual Transcription',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'manual_transcription': {'language': 'fr', 'value': 'Bonjour'}
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Manual Translation',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'manual_translation': {'language': 'en', 'value': 'Hello'},
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Automic Google Transcription',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'automatic_google_transcription': {'language': 'fr'}
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Automic Google Translation',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'automatic_google_translation': {'language': 'en'},
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Delete NLP action',
            description=(
                '`<action_id>` can be any of:'
                '<br>'
                '  * `manual_transcription`<br>'
                '  * `manual_translation`<br>'
                '  * `automatic_google_transcription`<br>'
                '  * `automatic_google_translation`<br>'
                ''
                '`<language>` is the language code, e.g. `en`.'
            ),
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    '<action_id>': {'language': '<language>', 'value': None},
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Accept automatic NLP action',
            description=(
                '`<action_id>` can be any of `automatic_google_transcription` or '
                '`automatic_google_translation`.<br>'
                '`<language>` is the language code, e.g. `en`.<br>'
                '`accepted` is a boolean. It can `true` or `false`.'
            ),
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    '<action_id>': {'language': '<language>', 'accepted': True},
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis – Integer Question',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'uuid': '11111111-1111-1111-1111-111111111111',
                        'value': 42,
                    }
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis – Text Question',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'uuid': '22222222-2222-2222-2222-222222222222',
                        'value': 'example-text',
                    }
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis – Single Choice Question',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'uuid': '33333333-3333-3333-3333-333333333333',
                        'value': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    }
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis – Multiple Choice Question',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'uuid': '44444444-4444-4444-4444-444444444444',
                        'value': [
                            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                        ],
                    }
                },
            },
            request_only=True,
        ),
        OpenApiExample(
            'Qualitative Analysis – Tags Question',
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'uuid': '44444444-4444-4444-4444-444444444444',
                        'value': ['tag1', 'tag2'],
                    }
                },
            },
            request_only=True,
        ),
    ]


def _get_data_supplement_response_examples():
    iso = '2025-01-01T12:00:00Z'

    return [
        OpenApiExample(
            name='Manual Transcription',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'manual_transcription': {
                        '_dateCreated': iso,
                        '_dateModified': iso,
                        '_versions': [
                            {
                                '_dateCreated': iso,
                                '_dateAccepted': iso,
                                '_uuid': '11111111-1111-1111-1111-111111111111',
                                '_data': {
                                    'language': 'fr',
                                    'value': 'Bonjour',
                                },
                            }
                        ],
                    }
                },
            },
        ),
        OpenApiExample(
            name='Manual Translation',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'manual_translation': {
                        'en': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_uuid': '22222222-2222-2222-2222-222222222222',
                                    '_data': {
                                        'language': 'en',
                                        'value': 'Hello',
                                    },
                                    '_dependency': {
                                        '_actionId': 'manual_transcription',
                                        '_uuid': '11111111-1111-1111-1111-111111111111',
                                    },
                                }
                            ],
                        },
                        'es': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_uuid': '33333333-3333-3333-3333-333333333333',
                                    '_data': {
                                        'language': 'es',
                                        'value': 'Hola',
                                    },
                                    '_dependency': {
                                        '_actionId': 'manual_transcription',
                                        '_uuid': '11111111-1111-1111-1111-111111111111',
                                    },
                                }
                            ],
                        },
                    }
                },
            },
        ),
        OpenApiExample(
            name='Automated Google Transcription',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'automated_google_transcription': {
                        '_dateCreated': iso,
                        '_dateModified': iso,
                        '_versions': [
                            {
                                '_dateCreated': iso,
                                '_uuid': '44444444-4444-4444-4444-444444444444',
                                '_data': {
                                    'language': 'en',
                                    'status': 'complete',
                                    'value': 'Hello world',
                                },
                                '_dateAccepted': iso,
                            },
                            {
                                '_dateCreated': iso,
                                '_uuid': '44444444-4444-4444-4444-444444444444',
                                '_data': {
                                    'language': 'en',
                                    'status': 'in_progress',
                                },
                            },
                        ],
                    }
                },
            },
        ),
        OpenApiExample(
            name='Automated Google Translation',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'automated_google_translation': {
                        'fr': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_uuid': '88888888-8888-8888-8888-888888888888',
                                    '_data': {
                                        'language': 'fr',
                                        'status': 'complete',
                                        'value': 'Bonjour le monde',
                                    },
                                    '_dependency': {
                                        '_actionId': 'automatic_google_transcription',
                                        '_uuid': '44444444-4444-4444-4444-444444444444',
                                    },
                                },
                                {
                                    '_dateCreated': iso,
                                    '_uuid': '77777777-7777-7777-7777-777777777777',
                                    '_data': {
                                        'language': 'fr',
                                        'status': 'in_progress',
                                    },
                                    '_dependency': {
                                        '_actionId': 'automatic_google_transcription',
                                        '_uuid': '44444444-4444-4444-4444-444444444444',
                                    },
                                },
                                {
                                    '_dateCreated': iso,
                                    '_uuid': '66666666-6666-6666-6666-666666666666',
                                    '_data': {
                                        'language': 'fr',
                                        'value': None,
                                        'status': 'deleted',
                                    },
                                    '_dependency': {
                                        '_actionId': 'automatic_google_transcription',
                                        '_uuid': '44444444-4444-4444-4444-444444444444',
                                    },
                                },
                                {
                                    '_dateCreated': iso,
                                    '_uuid': '55555555-5555-5555-5555-555555555555',
                                    'language': 'fr',
                                    '_data': {
                                        'status': 'complete',
                                        'value': 'Allo la foule',
                                    },
                                    '_dependency': {
                                        '_actionId': 'automatic_google_transcription',
                                        '_uuid': '44444444-4444-4444-4444-444444444444',
                                    },
                                },
                            ],
                        }
                    }
                },
            },
        ),
        OpenApiExample(
            name='Qualitative Analysis – Integer Question',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        '66666666-6666-6666-6666-666666666666': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_data': {
                                        'uuid': '66666666-6666-6666-6666-666666666666',
                                        'value': 42,
                                    },
                                    '_uuid': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                                }
                            ],
                        }
                    }
                },
            },
        ),
        OpenApiExample(
            name='Qualitative Analysis – Text Question',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_data': {
                                        'uuid': 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff',
                                        'value': 'This is a qualitative text response.',
                                    },
                                    '_uuid': '12121212-3434-5656-7878-909090909090',
                                }
                            ],
                        }
                    }
                },
            },
        ),
        OpenApiExample(
            name='Qualitative Analysis – Single Choice Question',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        '77777777-7777-7777-7777-777777777777': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_data': {

                                        'uuid': '77777777-7777-7777-7777-777777777777',
                                        'value': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                                    },
                                    '_uuid': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                                }
                            ],
                        }
                    }
                },
            },
        ),
        OpenApiExample(
            name='Qualitative Analysis – Multiple Choice Question',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        '88888888-8888-8888-8888-888888888888': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_data': {
                                        'uuid': '88888888-8888-8888-8888-888888888888',
                                        'value': [
                                            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                                            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                                        ],
                                    },
                                    '_uuid': '99999999-9999-9999-9999-999999999999',
                                }
                            ],
                        }
                    }
                },
            },
        ),
        OpenApiExample(
            name='Qualitative Analysis – Tags Question',
            response_only=True,
            value={
                '_version': '20250820',
                'question_name_xpath': {
                    'qual': {
                        'bbbbbbbb-cccc-dddd-eeee-ffffffffffff': {
                            '_dateCreated': iso,
                            '_dateModified': iso,
                            '_versions': [
                                {
                                    '_dateCreated': iso,
                                    '_dateAccepted': iso,
                                    '_data': {
                                        'uuid': 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
                                        'value': ['urgent', 'review', 'priority'],
                                    },
                                    '_dateCreated': iso,
                                    '_uuid': '23232323-4545-6767-8989-010101010101',
                                }
                            ],
                        }
                    }
                },
            },
        ),
    ]
