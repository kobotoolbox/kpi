# coding: utf-8
# WE SHOULD PUT MORE STRUCTURE ON THESE TAGS SO WE CAN ACCESS DOCUMENT
# FIELDS ELEGANTLY

ID = '_id'
UUID = '_uuid'
GPS = 'location/gps'

# Phone IMEI:
IMEI = 'imei'  # This tag was used in Phase II
END = 'end'

# extra fields that we're adding to our mongo doc
XFORM_ID_STRING = '_xform_id_string'
STATUS = '_status'
ATTACHMENTS = '_attachments'
UUID = '_uuid'
USERFORM_ID = '_userform_id'
DATE = '_date'
GEOLOCATION = '_geolocation'
SUBMISSION_TIME = '_submission_time'
DELETEDAT = '_deleted_at'  # no longer used but may persist in old submissions
SUBMITTED_BY = '_submitted_by'
VALIDATION_STATUS = '_validation_status'

META_INSTANCE_ID = 'meta/instanceID'
META_ROOT_UUID = 'meta/rootUuid'
# Ordered list (oldest first) of the KPI `AssetVersion` uids a submission has
# been through. Only written when a submission spans more than one version.
FORM_VERSIONS = 'formVersions'
META_FORM_VERSIONS = f'meta/{FORM_VERSIONS}'
# The single form version the client declares, injected by KPI as a `calculate`
# row at deploy time
VERSION = '__version__'

INDEX = '_index'
PARENT_INDEX = '_parent_index'
PARENT_TABLE_NAME = '_parent_table_name'

# datetime format that we store in mongo
MONGO_STRFTIME = '%Y-%m-%dT%H:%M:%S%:z'

# how to represent N/A in exports
NA_REP = 'n/a'
