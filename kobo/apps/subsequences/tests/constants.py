EMPTY_SUBMISSION = {}
EMPTY_SUPPLEMENT = {}

# What is a "question" supplement?
QUESTION_SUPPLEMENT = {
    'automatic_google_transcription': {
        '_dateCreated': '2024-04-08T15:27:00Z',
        '_dateModified': '2024-04-08T15:27:00Z',
        '_versions': [
            {
                '_data': {
                    'value': 'My audio has been transcribed automatically',
                    'language': 'en',
                    'status': 'completed',
                },
                '_dateCreated': '2024-04-08T15:27:00Z',
                '_dateAccepted': '2024-04-08T15:29:00Z',
                '_uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
            },
        ],
    },
    'manual_transcription': {
        '_dateCreated': '2024-04-08T15:28:00Z',
        '_dateModified': '2024-04-08T15:28:00Z',
        '_versions': [
            {
                '_data': {
                    'value': 'My audio has been transcribed manually',
                    'language': 'en',
                    'locale': 'en-CA',
                    'status': 'completed',
                },
                '_dateCreated': '2024-04-08T15:28:00Z',
                '_dateAccepted': '2024-04-08T15:28:00Z',
                '_uuid': 'd69b9263-04fd-45b4-b011-2e166cfefd4a',
            },
        ],
    },
}

# putting this in a fixture causes problems because of automatic migration on save
# so just make it a constant
# contains english transcript, spanish translation, and one of each type of QA question
# for 2 questions
OLD_STYLE_ADVANCED_FEATURES = {
    'qual': {
        'qual_survey': [
            {
                'labels': {'_default': 'Note'},
                'scope': 'by_question#survey',
                'type': 'qual_note',
                'uuid': '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f060',
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2620',
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910230',
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c40',
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e10',
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b20',
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72530',
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d40',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a0',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f90',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d0',
                'xpath': 'q1',
            },
            # q2: same UUIDs as q1, but last hex character incremented by +1
            {
                'labels': {'_default': 'Note'},
                'scope': 'by_question#survey',
                'type': 'qual_note',
                'uuid': '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f061',
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2621',
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910231',
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c41',
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e11',
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b21',
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72531',
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d41',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a1',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f91',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d1',
                'xpath': 'q2',
            },
        ]
    },
    'transcript': {'languages': ['en']},
    'translation': {'languages': ['es']},
}
