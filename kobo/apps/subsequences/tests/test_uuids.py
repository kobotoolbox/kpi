"""
UUID constants for subsequences tests.

This module contains valid UUID constants used across subsequences tests.
Each UUID is assigned to a descriptive variable name to improve test readability.

These UUIDs were created during the enforcement of UUID format validation in PR #6641.
"""

# =============================================================================
# audit_log test UUIDs
# =============================================================================

# Used in test_project_history_logs.py for QA tests
UUID_QUAL_WHY = 'b2d4f6e9-3a1c-4d83-8c50-7e2b1f9a4d11'  # 'Why?' question

# =============================================================================
# API test UUIDs
# =============================================================================

# Used in test_api.py for transcript testing
UUID_TRANSCRIPT_VERSION = 'c3f2a1d6-8e7b-4f2d-9a1c-6b9e4d8f2112'

# =============================================================================
# constants.py UUIDs - Question 1 (q1)
# =============================================================================

# qual_note for q1
UUID_QUAL_NOTE_Q1 = '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f060'

# qual_select_multiple for q1
UUID_QUAL_SELECT_MULTIPLE_Q1 = 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e10'
UUID_CHOICE_GREEN_Q1 = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2620'
UUID_CHOICE_RED_Q1 = '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910230'
UUID_CHOICE_BLUE_Q1 = '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c40'

# qual_select_one for q1
UUID_QUAL_SELECT_ONE_Q1 = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d40'
UUID_CHOICE_A_Q1 = 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b20'
UUID_CHOICE_B_Q1 = '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72530'

# qual_integer for q1
UUID_QUAL_INTEGER_Q1 = 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a0'

# qual_text for q1
UUID_QUAL_TEXT_Q1 = 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f90'

# qual_tags for q1
UUID_QUAL_TAGS_Q1 = 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d0'

# =============================================================================
# constants.py UUIDs - Question 2 (q2)
# Same as q1 but with last hex character incremented by +1
# =============================================================================

# qual_note for q2
UUID_QUAL_NOTE_Q2 = '0f3a9d2c-6e14-4b87-8c5a-71e2b4d9f061'

# qual_select_multiple for q2
UUID_QUAL_SELECT_MULTIPLE_Q2 = 'c2e1f9a6-4b8d-4f37-9a05-3d7b6c508e11'
UUID_CHOICE_GREEN_Q2 = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2621'
UUID_CHOICE_RED_Q2 = '4e8c2d1a-9f3b-4c76-8a50-b7d6e5910231'
UUID_CHOICE_BLUE_Q2 = '7a5c9b3e-1d2f-4e84-8b06-6f1d0a924c41'

# qual_select_one for q2
UUID_QUAL_SELECT_ONE_Q2 = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d41'
UUID_CHOICE_A_Q2 = 'a7d6b1e9-0c3f-4a25-8e84-9f2c5d418b21'
UUID_CHOICE_B_Q2 = '5f0b3c8a-2e1d-4a9f-8c76-41d9e6b72531'

# qual_integer for q2
UUID_QUAL_INTEGER_Q2 = 'f3b7a4e2-8d9c-4f1a-9b6e-2c5d1e7048a1'

# qual_text for q2
UUID_QUAL_TEXT_Q2 = 'a8c9e7d4-1f2b-4a6d-9c3e-5b704d2e1f91'

# qual_tags for q2
UUID_QUAL_TAGS_Q2 = 'b6d1f7c9-4e8a-4c2d-9f30-7a5e9c8b14d1'

# =============================================================================
# test_automatic_bedrock_qual.py UUIDs
# =============================================================================

# Question types
UUID_BEDROCK_INTEGER = 'a94c2b17-5f6e-4d88-8b31-2e9a7c6f54d0'
UUID_BEDROCK_SELECT_MULTIPLE = 'b1f8c6a9-2d4e-4a73-8c5f-9e0b6d1a2374'
UUID_BEDROCK_SELECT_ONE = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d43'
UUID_BEDROCK_TEXT = '3f2a1d6c-8e7b-4f2d-9a1c-6b9e4d8f21a3'

# Choices for select_multiple
UUID_CHOICE_EMPATHY = 'c4a9e2d1-7b6f-4a83-9d5e-1f8c3b2a0647'
UUID_CHOICE_APATHY = '8e1f2c9a-3d4b-4f6e-8a57-bc0d91e5a234'

# Choices for select_one (re-using bedrock select_multiple UUID for 'Yes')
UUID_CHOICE_YES = '6d8e4a1f-3b92-4c7a-9f61-0e5c2b7a8d43'
UUID_CHOICE_NO = 'b1f8c6a9-2d4e-4a73-8c5f-9e0b6d1a2374'

# Generic test UUIDs
UUID_TEST_MAIN = '8c1e2a40-7f9b-4d3e-9a5c-2b6e1d4f9a10'
UUID_TEST_CHOICE = 'f2a9c4e1-6b3d-4f8a-9c50-7e1b5d3a0a20'

# =============================================================================
# test_qual.py UUIDs
# =============================================================================

# Question types - detailed test suite
UUID_QUAL_INTEGER_DETAILED = 'a7d3e9c2-5b1f-4a86-8c40-9e2d1b7f3c30'
UUID_QUAL_TEXT_DETAILED = 'c1f9a2d4-6b8e-4a73-9c50-2e7b4d1f8a60'
UUID_QUAL_SELECT_ONE_DETAILED = '9e3b7a2c-5f1d-4c86-8a50-b2d4f6e91c70'
UUID_QUAL_SELECT_MULTI_DETAILED = '7e1b9c2a-4f6d-4c83-8a50-d3f2e9b6c140'

# Choices for select_one_detailed
UUID_CHOICE_HIGH = 'a4d9f7b6-1e2c-4a85-9c50-8b3f6e2d1a50'
UUID_CHOICE_MEDIUM = '5c7e1a9f-2b6d-4c84-8a50-4d3f2e9b6c60'
UUID_CHOICE_LOW = 'e1a4b9c7-6f2d-4a83-9e50-5d8c3f7b1a70'

# Choices for select_multi_detailed
UUID_TAG_SHELTER = '3b6f1d7a-2e4c-4a83-9c50-f9b8e2a1d990'
UUID_TAG_FOOD = '1f3a9c2e-4b7d-4a86-9c50-2e7b4d1f8a01'
UUID_TAG_MEDICAL = '4c8e2d1a-9f3b-4c76-8a50-b7d6e5910204'

# Color choice test UUIDs
UUID_CHOICE_RED_COLORS = '2a7d1e9c-5b3f-4c82-8a50-6c8f3a2b1d02'
UUID_CHOICE_BLUE_COLORS = '5d1f7c9b-4e8a-4c2d-9f30-7a5e9c8b1405'
UUID_CHOICE_PURPLE_COLORS = '6e2b8a7d-1c9f-4d63-9e50-6c1f3a82b906'
UUID_CHOICE_GREEN_COLORS = '7f1d8b3a-5e9c-4a26-8c50-2b6d4e9f7307'
UUID_QUAL_CHOICE_COLORS = 'c8f2b6a4-1d7e-4c95-8a50-9e3d1b7a2f80'

# Hide/unhide test UUIDs
UUID_QUAL_HIDE_ME = 'd4b1f7e9-2a3c-4d85-9c60-5e8a1b3f7d40'
UUID_QUAL_UNHIDE_ME = '8b6a4e3f-9c1d-4d72-8e50-2f7c1a9b6e20'

# Conversion test UUIDs
UUID_NEW_QUESTION = '3b6c9e4f-8a2d-4f75-9c50-7d3a2e1b4f03'

# =============================================================================
# test_versioning.py UUIDs
# =============================================================================

UUID_VERSIONING_A1 = '8a2c7d1f-9b3e-4a83-9c50-6e1d3b7a2f08'
UUID_VERSIONING_A2 = '9b6a4e1f-2c3d-4a85-8f97-5d0e7c1b2609'
UUID_VERSIONING_B1 = 'a1b2c3d4-9f12-4abc-94d3-fe7823cb8e10'
