from django.db import models

SUBMISSION_UUID_FIELD = 'meta/rootUuid'  # FIXME: import from elsewhere
SUPPLEMENT_KEY = '_supplementalDetails'  # leave unchanged for backwards compatibility
SORT_BY_DATE_FIELD = '_sortByDate'

# Could allow more types in the future? See
# formpack.utils.replace_aliases.MEDIA_TYPES
TRANSCRIBABLE_SOURCE_TYPES = ['audio', 'video', 'background-audio']
TRANSLATABLE_SOURCE_TYPES = TRANSCRIBABLE_SOURCE_TYPES + ['text']
QUAL_SOURCE_TYPES = TRANSLATABLE_SOURCE_TYPES

# `_actionId` value of the synthetic dependency attached when the source is read
# straight from a `text` survey question rather than from a transcript.
DEPENDENCY_SOURCE_SUBMISSION = 'submission'
# Field name shared with `BaseAction.ACTION_ID_FIELD`, duplicated here so the
# Google integration can read it without importing the actions package (which
# would create an import cycle: actions import integrations).
DEPENDENCY_ACTION_ID_FIELD = '_actionId'

ASYNC_TRANSLATION_DELAY_INTERVAL = 5

SUBSEQUENCES_ASYNC_CACHE_KEY = 'subsequences'

# Google speech api limits audio to ~480 Minutes*
# Processing time is not audio length, but it's an estimate
GOOGLE_CACHE_TIMEOUT = 28800  # 8 hours
GOOGLE_CODE = 'goog'

SCHEMA_VERSIONS = [
    '20250820',
    None,
]

QUESTION_TYPE_NOTE = 'qualNote'
QUESTION_TYPE_TEXT = 'qualText'
QUESTION_TYPE_TAGS = 'qualTags'
QUESTION_TYPE_SELECT_ONE = 'qualSelectOne'
QUESTION_TYPE_SELECT_MULTIPLE = 'qualSelectMultiple'
QUESTION_TYPE_INTEGER = 'qualInteger'
QUESTION_TYPE_VERIFICATION = 'qualVerification'
QUESTION_TYPE_SOURCE = 'qualSource'

SOURCE_TYPE_MANUAL = 'manual'
SOURCE_TYPE_AUTOMATIC = 'generated with AI'

SELECT_QUESTIONS = [QUESTION_TYPE_SELECT_MULTIPLE, QUESTION_TYPE_SELECT_ONE]


class Action(models.TextChoices):
    MANUAL_TRANSCRIPTION = 'manual_transcription'
    MANUAL_TRANSLATION = 'manual_translation'
    AUTOMATIC_GOOGLE_TRANSLATION = 'automatic_google_translation'
    AUTOMATIC_GOOGLE_TRANSCRIPTION = 'automatic_google_transcription'
    MANUAL_QUAL = 'manual_qual'
    AUTOMATIC_BEDROCK_QUAL = 'automatic_bedrock_qual'
