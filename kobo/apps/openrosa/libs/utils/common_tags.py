# coding: utf-8
# WE SHOULD PUT MORE STRUCTURE ON THESE TAGS SO WE CAN ACCESS DOCUMENT
# FIELDS ELEGANTLY

# These are common variable tags that we'll want to access
INSTANCE_DOC_NAME = "_name"
ID = "_id"
UUID = "_uuid"
PICTURE = "picture"
GPS = "location/gps"
SURVEY_TYPE = '_survey_type_slug'

# Phone IMEI:
DEVICE_ID = "device_id"  # This tag was used in Phase I
IMEI = "imei"            # This tag was used in Phase II
# Survey start time:
START_TIME = "start_time"  # This tag was used in Phase I
START = "start"            # This tag was used in Phase II
END_TIME = "end_time"
END = "end"

# value of INSTANCE_DOC_NAME that indicates a registration form
REGISTRATION = "registration"
# keys that we'll look for in the registration form
NAME = "name"

# extra fields that we're adding to our mongo doc
XFORM_ID_STRING = "_xform_id_string"
STATUS = "_status"
ATTACHMENTS = "_attachments"
UUID = "_uuid"
USERFORM_ID = "_userform_id"
DATE = "_date"
GEOLOCATION = "_geolocation"
SUBMISSION_TIME = '_submission_time'
DELETEDAT = "_deleted_at"  # no longer used but may persist in old submissions
SUBMITTED_BY = "_submitted_by"
VALIDATION_STATUS = "_validation_status"

INSTANCE_ID = "instanceID"
META_INSTANCE_ID = "meta/instanceID"
INDEX = "_index"
PARENT_INDEX = "_parent_index"
PARENT_TABLE_NAME = "_parent_table_name"

# datetime format that we store in mongo
MONGO_STRFTIME = '%Y-%m-%dT%H:%M:%S'

# how to represent N/A in exports
NA_REP = 'n/a'

# hold tags
TAGS = "_tags"

NOTES = "_notes"

# statistics
MEAN = "mean"
MIN = "min"
MAX = "max"
RANGE = "range"
MEDIAN = "median"
MODE = "mode"


# List of nested attributes which bypass 'dots' encoding
NESTED_RESERVED_ATTRIBUTES = [
    VALIDATION_STATUS,
]
