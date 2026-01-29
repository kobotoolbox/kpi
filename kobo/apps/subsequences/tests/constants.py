EMPTY_SUBMISSION = {}
EMPTY_SUPPLEMENT = {}

# =============================================================================
# UUID Constants for Tests
# =============================================================================
# These constants provide human-readable names for UUIDs used in tests,
# making test failures easier to understand.

# -----------------------------------------------------------------------------
# OLD_STYLE_ADVANCED_FEATURES UUIDs (used in constants.py and test_versioning.py)
# -----------------------------------------------------------------------------
# Q1 question UUIDs
QUAL_NOTE_Q1_UUID = '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f060'
QUAL_SELECT_MULTIPLE_Q1_UUID = 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e10'
QUAL_SELECT_ONE_Q1_UUID = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d40'
QUAL_INTEGER_Q1_UUID = 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a0'
QUAL_TEXT_Q1_UUID = 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f90'
QUAL_TAGS_Q1_UUID = 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d0'

# Q1 choice UUIDs
CHOICE_GREEN_Q1_UUID = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2620'
CHOICE_RED_Q1_UUID = '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910230'
CHOICE_BLUE_Q1_UUID = '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c40'
CHOICE_A_Q1_UUID = 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b20'
CHOICE_B_Q1_UUID = '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72530'

# Q2 question UUIDs (same as Q1, but last hex character incremented by +1)
QUAL_NOTE_Q2_UUID = '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f061'
QUAL_SELECT_MULTIPLE_Q2_UUID = 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e11'
QUAL_SELECT_ONE_Q2_UUID = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d41'
QUAL_INTEGER_Q2_UUID = 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a1'
QUAL_TEXT_Q2_UUID = 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f91'
QUAL_TAGS_Q2_UUID = 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d1'

# Q2 choice UUIDs
CHOICE_GREEN_Q2_UUID = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2621'
CHOICE_RED_Q2_UUID = '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910231'
CHOICE_BLUE_Q2_UUID = '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c41'
CHOICE_A_Q2_UUID = 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b21'
CHOICE_B_Q2_UUID = '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72531'

# -----------------------------------------------------------------------------
# test_api.py UUIDs
# -----------------------------------------------------------------------------
API_TEST_TRANSCRIPTION_UUID = 'c3f2a1d6-8e7b-4f2d-9a1c-6b9e4d8f2112'

# -----------------------------------------------------------------------------
# test_automatic_bedrock_qual.py UUIDs
# -----------------------------------------------------------------------------
# Main question UUIDs
BEDROCK_QUAL_INTEGER_UUID = 'a94c2b17-5f6e-4d88-8b31-2e9a7c6f54d0'
BEDROCK_QUAL_SELECT_MULTIPLE_UUID = 'b1f8c6a9-2d4e-4a73-8c5f-9e0b6d1a2374'
BEDROCK_QUAL_SELECT_ONE_UUID = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d43'
BEDROCK_QUAL_TEXT_UUID = '3f2a1d6c-8e7b-4f2d-9a1c-6b9e4d8f21a3'

# Choice UUIDs
BEDROCK_CHOICE_EMPATHY_UUID = 'c4a9e2d1-7b6f-4a83-9d5e-1f8c3b2a0647'
BEDROCK_CHOICE_APATHY_UUID = '8e1f2c9a-3d4b-4f6e-8a57-bc0d91e5a234'
# Note:
# - Yes choice reuses BEDROCK_QUAL_SELECT_ONE_UUID,
# - No choice reuses BEDROCK_QUAL_SELECT_MULTIPLE_UUID
BEDROCK_CHOICE_YES_UUID = BEDROCK_QUAL_SELECT_ONE_UUID
BEDROCK_CHOICE_NO_UUID = BEDROCK_QUAL_SELECT_MULTIPLE_UUID


# Validation test UUIDs
BEDROCK_VALIDATION_MAIN_UUID = '8c1e2a40-7f9b-4d3e-9a5c-2b6e1d4f9a10'
BEDROCK_VALIDATION_CHOICE_UUID = 'f2a9c4e1-6b3d-4f8a-9c50-7e1b5d3a0a20'

# -----------------------------------------------------------------------------
# test_qual.py - Fix class UUIDs
# -----------------------------------------------------------------------------
# Question UUIDs
FIX_QUAL_INTEGER_UUID = '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a'
FIX_QUAL_SELECT_MULTIPLE_UUID = '2e30bec7-4843-43c7-98bc-13114af230c5'
FIX_QUAL_SELECT_ONE_UUID = '1a8b748b-f470-4c40-bc09-ce2b1197f503'
FIX_QUAL_TAGS_UUID = 'e9b4e6d1-fdbb-4dc9-8b10-a9c3c388322f'
FIX_QUAL_TEXT_UUID = '83acf2a7-8edc-4fd8-8b9f-f832ca3f18ad'
FIX_QUAL_NOTE_UUID = '5ef11d48-d7a3-432e-af83-8c2e9b1feb72'

# Choice UUIDs for qualSelectMultiple
FIX_CHOICE_EMPATHY_UUID = '2e24e6b4-bc3b-4e8e-b0cd-d8d3b9ca15b6'
FIX_CHOICE_COMPETITION_UUID = 'cb82919d-2948-4ccf-a488-359c5d5ee53a'
FIX_CHOICE_APATHY_UUID = '8effe3b1-619e-4ada-be45-ebcea5af0aaf'

# Choice UUIDs for qualSelectOne
FIX_CHOICE_YES_UUID = '3c7aacdc-8971-482a-9528-68e64730fc99'
FIX_CHOICE_NO_UUID = '7e31c6a5-5eac-464c-970c-62c383546a94'

# -----------------------------------------------------------------------------
# test_qual.py - TestQualActionMethods class UUIDs
# -----------------------------------------------------------------------------
# Question UUIDs
METHOD_QUAL_INTEGER_UUID = 'a7d3e9c2-5b1f-4a86-8c40-9e2d1b7f3c30'
METHOD_QUAL_TEXT_UUID = 'c1f9a2d4-6b8e-4a73-9c50-2e7b4d1f8a60'
METHOD_QUAL_SELECT_ONE_UUID = '9e3b7a2c-5f1d-4c86-8a50-b2d4f6e91c70'
METHOD_QUAL_SELECT_MULTIPLE_UUID = '7e1b9c2a-4f6d-4c83-8a50-d3f2e9b6c140'

# Choice UUIDs for qualSelectOne (urgency levels)
METHOD_CHOICE_HIGH_UUID = 'a4d9f7b6-1e2c-4a85-9c50-8b3f6e2d1a50'
METHOD_CHOICE_MEDIUM_UUID = '5c7e1a9f-2b6d-4c84-8a50-4d3f2e9b6c60'
METHOD_CHOICE_LOW_UUID = 'e1a4b9c7-6f2d-4a83-9e50-5d8c3f7b1a70'

# Choice UUIDs for qualSelectMultiple (tags)
METHOD_CHOICE_SHELTER_UUID = '3b6f1d7a-2e4c-4a83-9c50-f9b8e2a1d990'
METHOD_CHOICE_FOOD_UUID = '1f3a9c2e-4b7d-4a86-9c50-2e7b4d1f8a01'
METHOD_CHOICE_MEDICAL_UUID = '4c8e2d1a-9f3b-4c76-8a50-b7d6e5910204'

# Additional UUIDs for update_params tests
METHOD_NEW_QUESTION_UUID = '3b6c9e4f-8a2d-4f75-9c50-7d3a2e1b4f03'
METHOD_COLORS_QUESTION_UUID = 'c8f2b6a4-1d7e-4c95-8a50-9e3d1b7a2f80'
METHOD_CHOICE_RED_UUID = '2a7d1e9c-5b3f-4c82-8a50-6c8f3a2b1d02'
METHOD_CHOICE_BLUE_UUID = '5d1f7c9b-4e8a-4c2d-9f30-7a5e9c8b1405'
METHOD_CHOICE_PURPLE_UUID = '6e2b8a7d-1c9f-4d63-9e50-6c1f3a82b906'
METHOD_CHOICE_GREEN_UUID = '7f1d8b3a-5e9c-4a26-8c50-2b6d4e9f7307'
METHOD_HIDE_QUESTION_UUID = 'd4b1f7e9-2a3c-4d85-9c60-5e8a1b3f7d40'
METHOD_UNHIDE_QUESTION_UUID = '8b6a4e3f-9c1d-4d72-8e50-2f7c1a9b6e20'

# -----------------------------------------------------------------------------
# test_versioning.py UUIDs
# -----------------------------------------------------------------------------
VERSIONING_QUAL_A1_UUID = '8a2c7d1f-9b3e-4a83-9c50-6e1d3b7a2f08'
VERSIONING_QUAL_A2_UUID = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2609'
VERSIONING_QUAL_B1_UUID = 'a1b2c3d4-9f12-4abc-94d3-fe7823cb8e10'
# UUIDs for migrate_submission_supplementals test
VERSIONING_QUAL_TEXT_UUID = '09327944-d4a4-4d59-9316-1250cf0799a4'
VERSIONING_QUAL_INTEGER_UUID = 'f57b263f-695c-4d74-88cb-14f1536f617c'

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
                'uuid': QUAL_NOTE_Q1_UUID,
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': CHOICE_GREEN_Q1_UUID,
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': CHOICE_RED_Q1_UUID,
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': CHOICE_BLUE_Q1_UUID,
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': QUAL_SELECT_MULTIPLE_Q1_UUID,
                'xpath': 'q1',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': CHOICE_A_Q1_UUID,
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': CHOICE_B_Q1_UUID,
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': QUAL_SELECT_ONE_Q1_UUID,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': QUAL_INTEGER_Q1_UUID,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': QUAL_TEXT_Q1_UUID,
                'xpath': 'q1',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': QUAL_TAGS_Q1_UUID,
                'xpath': 'q1',
            },
            # q2: same UUIDs as q1, but last hex character incremented by +1
            {
                'labels': {'_default': 'Note'},
                'scope': 'by_question#survey',
                'type': 'qual_note',
                'uuid': QUAL_NOTE_Q2_UUID,
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': CHOICE_GREEN_Q2_UUID,
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': CHOICE_RED_Q2_UUID,
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': CHOICE_BLUE_Q2_UUID,
                    },
                ],
                'labels': {'_default': 'Multiple?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_multiple',
                'uuid': QUAL_SELECT_MULTIPLE_Q2_UUID,
                'xpath': 'q2',
            },
            {
                'choices': [
                    {
                        'labels': {'_default': 'A'},
                        'uuid': CHOICE_A_Q2_UUID,
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': CHOICE_B_Q2_UUID,
                    },
                ],
                'labels': {'_default': 'Single?'},
                'scope': 'by_question#survey',
                'type': 'qual_select_one',
                'uuid': QUAL_SELECT_ONE_Q2_UUID,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Integer?'},
                'scope': 'by_question#survey',
                'type': 'qual_integer',
                'uuid': QUAL_INTEGER_Q2_UUID,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Text?'},
                'scope': 'by_question#survey',
                'type': 'qual_text',
                'uuid': QUAL_TEXT_Q2_UUID,
                'xpath': 'q2',
            },
            {
                'labels': {'_default': 'Tags?'},
                'scope': 'by_question#survey',
                'type': 'qual_tags',
                'uuid': QUAL_TAGS_Q2_UUID,
                'xpath': 'q2',
            },
        ]
    },
    'transcript': {'languages': ['en']},
    'translation': {'languages': ['es']},
}
