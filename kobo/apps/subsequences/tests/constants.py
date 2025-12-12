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
        ]
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
                'uuid': 'qual_note_q1',
                'xpath': 'q1',
            },
            {
                'choices': [
                    {'labels': {'_default': 'Green'}, 'uuid': 'green_q1'},
                    {'labels': {'_default': 'Red'}, 'uuid': 'red_q1'},
                    {'labels': {'_default': 'Blue'}, 'uuid': 'blue_q1'},
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': 'qual_select_multiple_q1',
                'xpath': 'q1',
            },
            {
                'choices': [
                    {'labels': {'_default': 'A'}, 'uuid': 'a_q1'},
                    {'labels': {'_default': 'B'}, 'uuid': 'b_q1'},
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': 'qual_select_one_q1',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': 'qual_integer_q1',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': 'qual_text_q1',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': 'qual_tags_q1',
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Note'},
                'scope': 'by_question#survey',
                'type': 'qual_note',
                'uuid': 'qual_note_q2',
                'xpath': 'q2',
            },
            {
                'choices': [
                    {'labels': {'_default': 'Green'}, 'uuid': 'green_q2'},
                    {'labels': {'_default': 'Red'}, 'uuid': 'red_q2'},
                    {'labels': {'_default': 'Blue'}, 'uuid': 'blue_q2'},
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': 'qual_select_multiple_q2',
                'xpath': 'q2',
            },
            {
                'choices': [
                    {'labels': {'_default': 'A'}, 'uuid': 'a_q2'},
                    {'labels': {'_default': 'B'}, 'uuid': 'b_q2'},
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': 'qual_select_one_q2',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': 'qual_integer_q2',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': 'qual_text_q2',
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': 'qual_tags_q2',
                'xpath': 'q2',
            },
        ]
    },
    'transcript': {'languages': ['en']},
    'translation': {'languages': ['es']},
}
