# coding: utf-8
SUBMISSION_FORMAT_TYPE_XML = "xml"
SUBMISSION_FORMAT_TYPE_JSON = "json"

GEO_QUESTION_TYPES = ('geopoint', 'geotrace', 'geoshape')

ASSET_TYPE_TEXT = 'text'
ASSET_TYPE_EMPTY = 'empty'
ASSET_TYPE_QUESTION = 'question'
ASSET_TYPE_BLOCK = 'block'
ASSET_TYPE_SURVEY = 'survey'
ASSET_TYPE_TEMPLATE = 'template'
ASSET_TYPE_COLLECTION = 'collection'

ASSET_TYPES = [
    (ASSET_TYPE_TEXT, ASSET_TYPE_TEXT),               # uncategorized, misc
    (ASSET_TYPE_EMPTY, ASSET_TYPE_EMPTY),             # useless, probably should be pruned

    (ASSET_TYPE_QUESTION, ASSET_TYPE_QUESTION),       # has no name
    (ASSET_TYPE_BLOCK, ASSET_TYPE_BLOCK),             # has a name, but no settings
    (ASSET_TYPE_SURVEY, ASSET_TYPE_SURVEY),           # has name, settings
    (ASSET_TYPE_TEMPLATE, ASSET_TYPE_TEMPLATE),       # quite same as survey, but can't be deployed, no submissions
    (ASSET_TYPE_COLLECTION, ASSET_TYPE_COLLECTION),   # an organizational container for other assets
]

ASSET_TYPES_WITH_CHILDREN = [
    ASSET_TYPE_COLLECTION,
]

# if an asset cannot have content, it should not be versioned
ASSET_TYPES_WITH_CONTENT = [
    ASSET_TYPE_TEXT,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_QUESTION,
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    # notably not ASSET_TYPE_COLLECTION
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

# Main app label for shadow models.
SHADOW_MODEL_APP_LABEL = 'shadow_model'
# List of app labels that need to read/write data from KoBoCAT database
# Useful in `db_routers.py`
SHADOW_MODEL_APP_LABELS = [
    SHADOW_MODEL_APP_LABEL,
    'superuser_stats',
]

# List of nested attributes which bypass 'dots' encoding
NESTED_MONGO_RESERVED_ATTRIBUTES = [
    "_validation_status",
]

PREFIX_PARTIAL_PERMS = 'partial_'
SUFFIX_SUBMISSIONS_PERMS = '_submissions'

# ASSIGNABLE_PERMISSIONS
PERM_VIEW_ASSET = 'view_asset'
PERM_CHANGE_ASSET = 'change_asset'
PERM_DISCOVER_ASSET = 'discover_asset'
PERM_MANAGE_ASSET = 'manage_asset'
PERM_ADD_SUBMISSIONS = 'add_submissions'
PERM_DELETE_SUBMISSIONS = 'delete_submissions'
PERM_VIEW_SUBMISSIONS = 'view_submissions'
PERM_PARTIAL_SUBMISSIONS = 'partial_submissions'
PERM_CHANGE_SUBMISSIONS = 'change_submissions'
PERM_VALIDATE_SUBMISSIONS = 'validate_submissions'

# CALCULATED_PERMISSIONS
PERM_DELETE_ASSET = 'delete_asset'
PERM_DELETE_SUBMISSIONS = 'delete_submissions'

# KC INTERNAL
PERM_FROM_KC_ONLY = 'from_kc_only'


ASSET_STATUS_DISCOVERABLE = 'public-discoverable'
ASSET_STATUS_PRIVATE = 'private'
ASSET_STATUS_PUBLIC = 'public'
ASSET_STATUS_SHARED = 'shared'

# Terms that can be used to search and filter return values
# from a query `q`
ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS = [
    'name__icontains',
    'owner__username__icontains',
    'settings__description__icontains',
    'summary__icontains',
    'tags__name__icontains',
    'uid__icontains',
]
