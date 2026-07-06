from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

"""
Common schemas to avoid redundancy
"""

ASSET_CLONE_FROM_SCHEMA = build_basic_type(OpenApiTypes.STR)

ASSET_CONTENT_SCHEMA = build_basic_type(OpenApiTypes.STR)

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
                'values': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
                'languages': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
            }
        ),
        'translation': build_object_type(
            properties={
                'values': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
                'languages': build_array_type(schema=build_basic_type(OpenApiTypes.STR)),
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
