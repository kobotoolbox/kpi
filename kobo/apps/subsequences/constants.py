from django.db import models

SUBMISSION_UUID_FIELD = 'meta/rootUuid'  # FIXME: import from elsewhere
SUPPLEMENT_KEY = '_supplementalDetails'  # leave unchanged for backwards compatibility
SORT_BY_DATE_FIELD = '_sortByDate'

# Could allow more types in the future? See
# formpack.utils.replace_aliases.MEDIA_TYPES
TRANSCRIBABLE_SOURCE_TYPES = ['audio', 'video', 'background-audio']
TRANSLATABLE_SOURCE_TYPES = TRANSCRIBABLE_SOURCE_TYPES + ['text']
QUAL_SOURCE_TYPES = TRANSLATABLE_SOURCE_TYPES

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

SELECT_QUESTIONS = [QUESTION_TYPE_SELECT_MULTIPLE, QUESTION_TYPE_SELECT_ONE]


class Action(models.TextChoices):
    MANUAL_TRANSCRIPTION = 'manual_transcription'
    MANUAL_TRANSLATION = 'manual_translation'
    AUTOMATIC_GOOGLE_TRANSLATION = 'automatic_google_translation'
    AUTOMATIC_GOOGLE_TRANSCRIPTION = 'automatic_google_transcription'
    MANUAL_QUAL = 'manual_qual'
    AUTOMATIC_BEDROCK_QUAL = 'automatic_bedrock_qual'
