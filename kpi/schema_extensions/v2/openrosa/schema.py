from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes


"""
Common schemas to avoid redundancy
"""

XFORM_SCHEMA = build_object_type(
        properties={
            'head': build_object_type(
                properties={
                    'title': build_basic_type(OpenApiTypes.STR),
                    'model': build_object_type(
                        properties={
                            'instance': build_object_type(
                                properties={
                                    'instanceUuid': build_object_type(
                                        properties={
                                            'fieldName': build_basic_type(
                                                OpenApiTypes.NONE
                                            ),
                                            'meta': build_object_type(
                                                properties={
                                                    'instanceID': build_basic_type(
                                                        OpenApiTypes.NONE
                                                    ),
                                                }
                                            ),
                                        },
                                    ),
                                },
                            ),
                        },
                    ),
                },
            ),
            'body': build_object_type(
                properties={
                    'input': build_object_type(
                        properties={
                            'label': build_basic_type(OpenApiTypes.STR),
                            'hint': build_basic_type(OpenApiTypes.STR),
                        },
                    ),
                },
            ),
        },
    )
