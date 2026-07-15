from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import NULLABLE_STRING_SCHEMA

"""
Common schemas to avoid redundancy
"""

ASSET_CLONE_FROM_SCHEMA = build_basic_type(OpenApiTypes.STR)

# Asset content can be sent as a JSON string (write) or received as an object (read)
ASSET_CONTENT_REQUEST_SCHEMA = build_basic_type(OpenApiTypes.STR)

ASSET_ENABLED_SCHEMA = build_basic_type(OpenApiTypes.BOOL)

ASSET_FIELDS_SCHEMA = build_array_type(schema=build_basic_type(OpenApiTypes.STR))

ASSET_SETTINGS_SCHEMA = build_object_type(
    properties={
        'description': build_basic_type(OpenApiTypes.STR),
        'sector': build_basic_type(OpenApiTypes.STR),
        'country': build_basic_type(OpenApiTypes.STR),
        'share-metadata': build_basic_type(OpenApiTypes.BOOL),
    }
)

ASSET_NAME_SCHEMA = build_basic_type(OpenApiTypes.STR)

ASSET_TAG_STRING_SCHEMA = build_basic_type(OpenApiTypes.STR)

ASSET_TYPE_SCHEMA = build_basic_type(OpenApiTypes.STR)

BULK_ACTION_SCHEMA = build_basic_type(OpenApiTypes.STR)

BULK_ASSET_UIDS_SCHEMA = build_object_type(
    properties={
        'asset_uids': build_array_type(
            schema=build_object_type(
                properties={},
            ),
        ),
    }
)

BULK_CONFIRM_SCHEMA = build_basic_type(OpenApiTypes.BOOL)

# Assignable permissions can have label as string (regular) or object (partial)
ASSIGNABLE_PERMISSION_PARTIAL_LABEL_SCHEMA = build_object_type(
    required=['default'],
    properties={
        'default': build_basic_type(OpenApiTypes.STR),
        'view_submissions': build_basic_type(OpenApiTypes.STR),
        'change_submissions': build_basic_type(OpenApiTypes.STR),
        'delete_submissions': build_basic_type(OpenApiTypes.STR),
        'validate_submissions': build_basic_type(OpenApiTypes.STR),
    }
)

ASSIGNABLE_PERMISSION_SCHEMA = build_object_type(
    required=['url', 'label'],
    properties={
        'url': build_basic_type(OpenApiTypes.STR),
        'label': {
            'oneOf': [
                build_basic_type(OpenApiTypes.STR),
                ASSIGNABLE_PERMISSION_PARTIAL_LABEL_SCHEMA,
            ]
        },
    }
)

# Permission assignment response (actual permission grants)
PARTIAL_PERMISSION_FILTER_SCHEMA = build_object_type(
    properties={
        'url': build_basic_type(OpenApiTypes.STR),
        'filters': build_array_type(schema=build_object_type(properties={})),
    }
)

PERMISSION_ASSIGNMENT_SCHEMA = build_object_type(
    required=['url', 'user', 'permission'],
    properties={
        'url': build_basic_type(OpenApiTypes.STR),
        'user': build_basic_type(OpenApiTypes.STR),
        'permission': build_basic_type(OpenApiTypes.STR),
        'partial_permissions': build_array_type(
            schema=PARTIAL_PERMISSION_FILTER_SCHEMA
        ),
        'label': {
            'oneOf': [
                build_basic_type(OpenApiTypes.STR),
                ASSIGNABLE_PERMISSION_PARTIAL_LABEL_SCHEMA,
            ]
        },
    }
)

REPORT_STYLE_SCHEMA = build_object_type(
    properties={
        'groupDataBy': build_basic_type(OpenApiTypes.STR),
        'report_type': build_basic_type(OpenApiTypes.STR),
        'report_colors': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
        'translationIndex': build_basic_type(OpenApiTypes.INT),
        'graphWidth': build_basic_type(OpenApiTypes.INT),
    }
)

ANALYSIS_QUESTION_LABELS_SCHEMA = build_object_type(
    required=['_default'],
    properties={
        '_default': build_basic_type(OpenApiTypes.STR),
    },
    additionalProperties=build_basic_type(OpenApiTypes.STR),
)

ANALYSIS_QUESTION_CHOICE_SCHEMA = build_object_type(
    required=['labels', 'uuid'],
    properties={
        'labels': ANALYSIS_QUESTION_LABELS_SCHEMA,
        'uuid': build_basic_type(OpenApiTypes.STR),
        'options': build_object_type(
            properties={
                'deleted': build_basic_type(OpenApiTypes.BOOL),
            }
        ),
    }
)

ANALYSIS_QUESTION_SCHEMA = build_object_type(
    required=['type', 'labels', 'xpath', 'scope'],
    properties={
        'type': build_basic_type(OpenApiTypes.STR),
        'labels': ANALYSIS_QUESTION_LABELS_SCHEMA,
        'uuid': build_basic_type(OpenApiTypes.STR),
        'options': build_object_type(
            properties={
                'deleted': build_basic_type(OpenApiTypes.BOOL),
            }
        ),
        'xpath': build_basic_type(OpenApiTypes.STR),
        'scope': build_basic_type(OpenApiTypes.STR),
        'choices': build_array_type(schema=ANALYSIS_QUESTION_CHOICE_SCHEMA),
    }
)

ADVANCED_FEATURES_SCHEMA = build_object_type(
    properties={
        'transcript': build_object_type(
            properties={
                'values': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR)
                ),
                'languages': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR)
                ),
            }
        ),
        'translation': build_object_type(
            properties={
                'values': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR)
                ),
                'languages': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR)
                ),
            }
        ),
        'qual': build_object_type(
            properties={
                'qual_survey': build_array_type(schema=ANALYSIS_QUESTION_SCHEMA),
            }
        ),
        '_version': build_basic_type(OpenApiTypes.STR),
    }
)

MAP_STYLES_SCHEMA = build_object_type(
    properties={
        'colorSet': build_basic_type(OpenApiTypes.STR),
        'querylimit': build_basic_type(OpenApiTypes.STR),
        'selectedQuestion': build_basic_type(OpenApiTypes.STR),
    }
)

SURVEY_ROW_SCHEMA = build_object_type(
    required=['$kuid', 'type'],
    properties={
        '$kuid': build_basic_type(OpenApiTypes.STR),
        'type': build_basic_type(OpenApiTypes.STR),
        '$xpath': build_basic_type(OpenApiTypes.STR),
        '$autoname': build_basic_type(OpenApiTypes.STR),
        'calculation': build_basic_type(OpenApiTypes.STR),
        'label': build_array_type(schema=NULLABLE_STRING_SCHEMA),
        'hint': build_array_type(schema=NULLABLE_STRING_SCHEMA),
        'name': build_basic_type(OpenApiTypes.STR),
        'required': build_basic_type(OpenApiTypes.BOOL),
        'appearance': build_basic_type(OpenApiTypes.STR),
        'parameters': build_basic_type(OpenApiTypes.STR),
        'kobo--matrix_list': build_basic_type(OpenApiTypes.STR),
        'kobo--rank-constraint-message': build_basic_type(OpenApiTypes.STR),
        'kobo--rank-items': build_basic_type(OpenApiTypes.STR),
        'kobo--score-choices': build_basic_type(OpenApiTypes.STR),
        'kobo--locking-profile': build_basic_type(OpenApiTypes.STR),
        'tags': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
        'select_from_list_name': build_basic_type(OpenApiTypes.STR),
        'body::accept': build_basic_type(OpenApiTypes.STR),
    },
    additionalProperties=True,
)

SURVEY_CHOICE_SCHEMA = build_object_type(
    required=['$autovalue', '$kuid', 'list_name', 'name'],
    properties={
        '$autovalue': build_basic_type(OpenApiTypes.STR),
        '$kuid': build_basic_type(OpenApiTypes.STR),
        'label': build_array_type(schema=NULLABLE_STRING_SCHEMA),
        'list_name': build_basic_type(OpenApiTypes.STR),
        'name': build_basic_type(OpenApiTypes.STR),
        'media::image': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
        '$autoname': build_basic_type(OpenApiTypes.STR),
    },
    additionalProperties=True,
)

ASSET_CONTENT_SETTINGS_SCHEMA = build_object_type(
    properties={
        'name': build_basic_type(OpenApiTypes.STR),
        'version': build_basic_type(OpenApiTypes.STR),
        'id_string': build_basic_type(OpenApiTypes.STR),
        'style': build_basic_type(OpenApiTypes.STR),
        'form_id': build_basic_type(OpenApiTypes.STR),
        'title': build_basic_type(OpenApiTypes.STR),
        'kobo--lock_all': build_basic_type(OpenApiTypes.BOOL),
        'kobo--locking-profile': build_basic_type(OpenApiTypes.STR),
        'default_language': NULLABLE_STRING_SCHEMA,
    }
)

ASSET_CONTENT_RESPONSE_SCHEMA = build_object_type(
    properties={
        'schema': build_basic_type(OpenApiTypes.STR),
        'survey': build_array_type(schema=SURVEY_ROW_SCHEMA),
        'choices': build_array_type(schema=SURVEY_CHOICE_SCHEMA),
        'settings': ASSET_CONTENT_SETTINGS_SCHEMA,
        'translated': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
        'translations': build_array_type(schema=NULLABLE_STRING_SCHEMA),
        'translations_0': NULLABLE_STRING_SCHEMA,
        'kobo--locking-profiles': build_array_type(
            schema=build_basic_type(OpenApiTypes.OBJECT)
        ),
    }
)
