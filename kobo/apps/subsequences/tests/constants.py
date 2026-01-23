from kobo.apps.subsequences.tests.test_uuids import (
    UUID_CHOICE_A_Q1,
    UUID_CHOICE_A_Q2,
    UUID_CHOICE_B_Q1,
    UUID_CHOICE_B_Q2,
    UUID_CHOICE_BLUE_Q1,
    UUID_CHOICE_BLUE_Q2,
    UUID_CHOICE_GREEN_Q1,
    UUID_CHOICE_GREEN_Q2,
    UUID_CHOICE_RED_Q1,
    UUID_CHOICE_RED_Q2,
    UUID_QUAL_INTEGER_Q1,
    UUID_QUAL_INTEGER_Q2,
    UUID_QUAL_NOTE_Q1,
    UUID_QUAL_NOTE_Q2,
    UUID_QUAL_SELECT_MULTIPLE_Q1,
    UUID_QUAL_SELECT_MULTIPLE_Q2,
    UUID_QUAL_SELECT_ONE_Q1,
    UUID_QUAL_SELECT_ONE_Q2,
    UUID_QUAL_TAGS_Q1,
    UUID_QUAL_TAGS_Q2,
    UUID_QUAL_TEXT_Q1,
    UUID_QUAL_TEXT_Q2,
)

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
                'uuid': UUID_QUAL_NOTE_Q1,
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': UUID_CHOICE_GREEN_Q1,
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': UUID_CHOICE_RED_Q1,
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': UUID_CHOICE_BLUE_Q1,
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': UUID_QUAL_SELECT_MULTIPLE_Q1,
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': UUID_CHOICE_A_Q1,
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': UUID_CHOICE_B_Q1,
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': UUID_QUAL_SELECT_ONE_Q1,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': UUID_QUAL_INTEGER_Q1,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': UUID_QUAL_TEXT_Q1,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': UUID_QUAL_TAGS_Q1,
                'xpath': 'q1',
            },
            # q2: same UUIDs as q1, but last hex character incremented by +1
            {
                'labels': {'_default': 'Note'},
                'scope': 'by_question#survey',
                'type': 'qual_note',
                'uuid': UUID_QUAL_NOTE_Q2,
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': UUID_CHOICE_GREEN_Q2,
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': UUID_CHOICE_RED_Q2,
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': UUID_CHOICE_BLUE_Q2,
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': UUID_QUAL_SELECT_MULTIPLE_Q2,
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': UUID_CHOICE_A_Q2,
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': UUID_CHOICE_B_Q2,
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': UUID_QUAL_SELECT_ONE_Q2,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': UUID_QUAL_INTEGER_Q2,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': UUID_QUAL_TEXT_Q2,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': UUID_QUAL_TAGS_Q2,
                'xpath': 'q2',
            },
        ]
    },
    'transcript': {'languages': ['en']},
    'translation': {'languages': ['es']},
}
