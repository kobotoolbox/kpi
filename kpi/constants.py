# coding: utf-8
SUBMISSION_FORMAT_TYPE_XML = 'xml'
SUBMISSION_FORMAT_TYPE_JSON = 'json'

GEO_QUESTION_TYPES = ('geopoint', 'geotrace', 'geoshape')
ATTACHMENT_QUESTION_TYPES = (
    'audit',
    'image',
    'audio',
    'video',
    'file',
    'background-audio',
)

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

CLONE_ARG_NAME = 'clone_from'
CLONE_FROM_VERSION_ID_ARG_NAME = 'clone_from_version_id'
COLLECTION_CLONE_FIELDS = {'name'}

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

DEFAULT_SURVEY_NAME = '__kobo_default_survey_name_value__'

ASSET_TYPE_ARG_NAME = 'asset_type'

# List of app labels that need to read/write data from KoBoCAT database
# Useful in `db_routers.py`
SHADOW_MODEL_APP_LABELS = [
    'superuser_stats',
]

SHARED_APP_LABELS = [
    'auth',
    'contenttypes',
    'kobo_auth',
    'sessions',
    'taggit',
]


# List of nested attributes which bypass 'dots' encoding
NESTED_MONGO_RESERVED_ATTRIBUTES = [
    '_validation_status',
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

# CUSTOM PROJECT PERMISSIONS
PERM_CHANGE_METADATA_ASSET = 'change_metadata_asset'

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

SKIP_HEAVY_MIGRATIONS_GUIDANCE = (
    """
    This migration might take a while. If it is too slow, you may want to
    re-run migrations with SKIP_HEAVY_MIGRATIONS=True and apply this one
    manually from the django shell.
    """
)

LIMIT_HOURS_23 = 82800

ACCESS_LOG_LOGINAS_AUTH_TYPE = 'django-loginas'
ACCESS_LOG_UNKNOWN_AUTH_TYPE = 'unknown'
ACCESS_LOG_SUBMISSION_AUTH_TYPE = 'submission'
ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE = 'submission-group'
ACCESS_LOG_AUTHORIZED_APP_TYPE = 'authorized-application'

PROJECT_HISTORY_LOG_PROJECT_SUBTYPE = 'project'
PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE = 'permission'
PROJECT_HISTORY_LOG_METADATA_FIELD_NEW = 'new'
PROJECT_HISTORY_LOG_METADATA_FIELD_OLD = 'old'
PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED = 'added'
PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED = 'removed'

API_NAMESPACES = {
    'v1': None,
    'v2': 'api_v2',
    'default': 'api_v2',
}

SAFE_INLINE_MIMETYPES = {
    # images (no svg)
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/bmp',
    'image/x-ms-bmp',
    'image/tiff',
    'image/jp2',
    'image/x-icon',
    'image/vnd.wap.wbmp',
    # audio
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/aac',
    'audio/aac-adts',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/aiff',
    'audio/x-aiff',
    'audio/ogg',
    'audio/flac',
    'audio/webm',
    'audio/amr',
    'audio/amr-wb',
    'audio/vnd.wave',
    # video
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/mov',
    'video/x-m4v',
    'video/mpeg',
    'video/3gpp',
    'video/x-msvideo',
    'video/x-ms-wmv',
}

# MIME types not supported inline by browsers, fallback to JPEG conversion
UNSUPPORTED_INLINE_MIMETYPES = [
    'image/heic',
    'image/heif',
]

# LLM Prompt used to generate this allowlist:
#
# Generate a dictionary of allowed fields for each model in KoboToolbox KPI's q search.
# The list must cover paths used by real searches (e.g. owner__username, parent__uid,
# asset_type, summary__icontains, the status special-case, JSONField roots like
# settings, summary, extra_details__data, etc.). Keep the uniform-rejection behavior
# for disallowed paths. Only whitelist explicitly what is allowed. Make a comprehensive
# search across the codebase for all instances of SearchFilter to identify any views
# that use the query parser in order to make sure we don't miss anything. The list will
# be maintained in `kpi.contants.ALLOWED_LOOKUP_FIELDS`. The idea is to block
# sensitive data from being used with search filters
# Granularity is at the explicit model level.
# ```
# ALLOWED_LOOKUP_FIELDS = {
       'app_label.model_name': {'field1', 'field2', ...},
      ...
# }
# ```
ALLOWED_LOOKUP_FIELDS = {
    'auth.user': frozenset({
        'username',
        'extra_details',   # To allow extra_details__data
    }),
    'audit_log.accesslog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'audit_log.auditlog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'audit_log.projecthistorylog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'hub.extrauserdetail': frozenset({
        'data',
    }),
    'kobo_auth.user': frozenset({
        'username',
        'extra_details',   # To allow extra_details__data
    }),
    'kpi.asset': frozenset({
        'asset_type',
        'date_created',
        'date_deployed',
        'date_modified',
        'name',
        'owner',
        'parent',
        'settings',
        'status',          # Special-cased in code, but good to whitelist explicitly
        'summary',
        'tags',
        'uid',
        'data_sharing',    # To allow data_sharing__enabled
        'last_modified_by',
    }),
    'kpi.importexporttask': frozenset({
        'data',
        'date_created',
        'status',
        'user',
    }),
    'kpi.importtask': frozenset({
        'data',
        'date_created',
        'status',
        'user',
    }),
    'kpi.submissionexporttask': frozenset({
        'data',
        'date_created',
        'status',
        'user',
    }),
    'kpi.submissionsynchronousexport': frozenset({
        'data',
        'date_created',
        'status',
        'user',
    }),
    'kpi.userassetsubscription': frozenset({
        'id',
        'status',
        'subscribed_date',
    }),
    'languages.language': frozenset({
        'code',
        'name',
        'featured',
        'transcription_services',
        'translation_services',
    }),
    'languages.transcriptionservice': frozenset({
        'code',
        'name',
    }),
    'languages.translationservice': frozenset({
        'code',
        'name',
    }),
    'project_views.projectview': frozenset({
        'name',
        'countries',
        'organizations',
        'permissions',
        'users',
    }),
    'user_reports.userreports': frozenset({
        'username',
        'first_name',
        'last_name',
    }),
    'taggit.tag': frozenset({
        'name',
    }),
}
# The denylist is kept purely as documentation and does not participate in runtime
# authorization. It records what is explicitly banned and why.
DENIED_LOOKUP_FIELDS = {
    # Models that must NEVER be traversed to protect sensitive data
    # (e.g., tokens, credentials):
    'account.emailconfirmation': frozenset({'*'}),
    'accounts_mfa.mfamethodswrapper': frozenset({'*'}),
    'authtoken.token': frozenset({'*'}),
    'auth.user': frozenset({
        'password',
    }),
    'django_digest.partialdigest': frozenset({'*'}),
    'kobo_auth.user': frozenset({
        'password',
    }),
    'hub.extrauserdetail': frozenset({
        'private_data',
    }),
    'kpi.extrauserdetail': frozenset({
        'private_data',
    }),
    'mfa.authenticator': frozenset({'*'}),
    'socialaccount.socialaccount': frozenset({'*'}),
    'socialaccount.socialtoken': frozenset({'*'}),
    'socialaccount.socialapp': frozenset({'*'}),
    '*': frozenset({
        'secret',
        'token',
    }),
}
