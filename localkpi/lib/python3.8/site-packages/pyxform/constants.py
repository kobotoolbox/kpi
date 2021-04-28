# -*- coding: utf-8 -*-
"""
This file contains constants that correspond with the property names in the
json survey format. (@see json_form_schema.json) These names are to be shared
between X2json and json2Y programs. By putting them in a shared file,
the literal names can be easily changed, typos can be avoided, and references
are easier to find.
"""
# TODO: Replace matching strings in the json2xforms code (builder.py,
# survey.py, survey_element.py, question.py) with these constants

TYPE = "type"
TITLE = "title"
NAME = "name"
ID_STRING = "id_string"
SMS_KEYWORD = "sms_keyword"
SMS_FIELD = "sms_field"
SMS_OPTION = "sms_option"
SMS_SEPARATOR = "sms_separator"
SMS_ALLOW_MEDIA = "sms_allow_media"
SMS_DATE_FORMAT = "sms_date_format"
SMS_DATETIME_FORMAT = "sms_datetime_format"
SMS_RESPONSE = "sms_response"

# compact representation (https://opendatakit.github.io/xforms-spec/#compact-record-representation-(for-sms))
COMPACT_PREFIX = "prefix"
COMPACT_DELIMITER = "delimiter"
COMPACT_TAG = "compact_tag"

VERSION = "version"
PUBLIC_KEY = "public_key"
SUBMISSION_URL = "submission_url"
AUTO_SEND = "auto_send"
AUTO_DELETE = "auto_delete"
DEFAULT_LANGUAGE = "default_language"
LABEL = "label"
HINT = "hint"
STYLE = "style"
ATTRIBUTE = "attribute"
ALLOW_CHOICE_DUPLICATES = "allow_choice_duplicates"

BIND = (
    "bind"
)  # TODO: What should I do with the nested types? (readonly and relevant) # noqa
MEDIA = "media"
CONTROL = "control"
APPEARANCE = "appearance"

LOOP = "loop"
COLUMNS = "columns"

REPEAT = "repeat"
GROUP = "group"
CHILDREN = "children"

SELECT_ONE = "select one"
SELECT_ALL_THAT_APPLY = "select all that apply"
RANK = "rank"
CHOICES = "choices"

# XLS Specific constants
LIST_NAME = "list name"
CASCADING_SELECT = "cascading_select"
TABLE_LIST = (
    "table-list"
)  # hyphenated because it goes in appearance, and convention for appearance column is dashes # noqa

# The following are the possible sheet names:
SURVEY = "survey"
SETTINGS = "settings"
EXTERNAL_CHOICES = "external_choices"
# These sheet names are for list sheets
CHOICES_AND_COLUMNS = "choices and columns"
CASCADING_CHOICES = "cascades"

OSM = "osm"
OSM_TYPE = "binary"

NAMESPACES = "namespaces"

SUPPORTED_SHEET_NAMES = [
    SURVEY,
    CASCADING_CHOICES,
    CHOICES,
    COLUMNS,
    CHOICES_AND_COLUMNS,
    SETTINGS,
    EXTERNAL_CHOICES,
    OSM,
]
SUPPORTED_FILE_EXTENSIONS = [".xls", ".xlsx", ".xlsm"]

LOCATION_PRIORITY = "location-priority"
LOCATION_MIN_INTERVAL = "location-min-interval"
LOCATION_MAX_AGE = "location-max-age"
TRACK_CHANGES = "track-changes"

# supported bind keywords for which external instances will be created for pulldata function
EXTERNAL_INSTANCES = ["calculate", "constraint", "readonly", "required", "relevant"]
