# -*- coding: utf-8 -*-
from __future__ import unicode_literals

INSTANCE_FORMAT_TYPE_XML = "xml"
INSTANCE_FORMAT_TYPE_JSON = "json"

ASSET_TYPE_TEXT = 'text'
ASSET_TYPE_EMPTY = 'empty'
ASSET_TYPE_QUESTION = 'question'
ASSET_TYPE_BLOCK = 'block'
ASSET_TYPE_SURVEY = 'survey'
ASSET_TYPE_TEMPLATE = 'template'

ASSET_TYPES = [
    (ASSET_TYPE_TEXT, ASSET_TYPE_TEXT),               # uncategorized, misc
    (ASSET_TYPE_EMPTY, ASSET_TYPE_EMPTY),             # useless, probably should be pruned

    (ASSET_TYPE_QUESTION, ASSET_TYPE_QUESTION),       # has no name
    (ASSET_TYPE_BLOCK, ASSET_TYPE_BLOCK),             # has a name, but no settings
    (ASSET_TYPE_SURVEY, ASSET_TYPE_SURVEY),           # has name, settings
    (ASSET_TYPE_TEMPLATE, ASSET_TYPE_TEMPLATE),       # quite same as survey, but can't be deployed, no submissions
]


CLONE_ARG_NAME = "clone_from"
CLONE_FROM_VERSION_ID_ARG_NAME = "clone_from_version_id"
COLLECTION_CLONE_FIELDS = {"name"}

# Types are declared in `kpi.models.assets.ASSET_TYPES`.
# These values correspond to index 0 of each tuple of ASSET_TYPES
CLONE_COMPATIBLE_TYPES = {
    ASSET_TYPE_TEXT: [ASSET_TYPE_TEXT],  # We don't know if it's used, so keep it safe, only allow cloning from/to its own kind
    ASSET_TYPE_EMPTY: [ASSET_TYPE_EMPTY],  # We don't know if it's used, so keep it safe, only allow cloning from/to its own kind
    ASSET_TYPE_QUESTION: [ASSET_TYPE_QUESTION, ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE],
    ASSET_TYPE_BLOCK: [ASSET_TYPE_BLOCK, ASSET_TYPE_QUESTION, ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE],
    ASSET_TYPE_SURVEY: [ASSET_TYPE_BLOCK, ASSET_TYPE_QUESTION, ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE],
    ASSET_TYPE_TEMPLATE: [ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE]
}

ASSET_TYPE_ARG_NAME = "asset_type"

SHADOW_MODEL_APP_LABEL = "shadow_model"

# List of nested attributes which bypass 'dots' encoding
NESTED_MONGO_RESERVED_ATTRIBUTES = [
    "_validation_status",
]
