from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    LABEL_VALUE_OBJECT_SCHEMA,
    USER_URL_SCHEMA,
)


class ActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.history.fields.ActionField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.history.fields.MetadataField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': GENERIC_STRING_SCHEMA,
                'settings': build_object_type(
                    properties={
                        'sector': build_object_type(
                            properties={
                                'new': LABEL_VALUE_OBJECT_SCHEMA,
                                'old': LABEL_VALUE_OBJECT_SCHEMA,
                            }
                        ),
                        'country': build_object_type(
                            properties={
                                'added': LABEL_VALUE_OBJECT_SCHEMA,
                                'removed': LABEL_VALUE_OBJECT_SCHEMA,
                            }
                        ),
                        'description': build_object_type(
                            properties={
                                'new': GENERIC_STRING_SCHEMA,
                                'old': GENERIC_STRING_SCHEMA,
                            }
                        ),
                        'country_codes': build_object_type(
                            properties={
                                'added': GENERIC_ARRAY_SCHEMA,
                                'removed': GENERIC_ARRAY_SCHEMA,
                            }
                        ),
                        'data-table': build_object_type(
                            properties={
                                'new': GENERIC_OBJECT_SCHEMA,
                                'old': GENERIC_OBJECT_SCHEMA,
                            }
                        ),
                    }
                ),
                'asset_uid': GENERIC_STRING_SCHEMA,
                'ip_address': GENERIC_STRING_SCHEMA,
                'log_subtype': GENERIC_STRING_SCHEMA,
                'project_owner': GENERIC_STRING_SCHEMA,
                'latest_version_uid': GENERIC_STRING_SCHEMA,
                'asset-files': build_object_type(
                    properties={
                        'uid': GENERIC_STRING_SCHEMA,
                        'filename': GENERIC_STRING_SCHEMA,
                        'md5_hash': GENERIC_STRING_SCHEMA,
                        'download_url': GENERIC_STRING_SCHEMA,
                    }
                ),
                'permissions': build_object_type(
                    properties={
                        'added': GENERIC_ARRAY_SCHEMA,
                        'removed': GENERIC_ARRAY_SCHEMA,
                        'username': GENERIC_STRING_SCHEMA,
                    }
                ),
                'latest_deployed_version_uid': GENERIC_STRING_SCHEMA,
                'submission': build_object_type(
                    properties={
                        'root_uuid': GENERIC_STRING_SCHEMA,
                        'submitted_by': GENERIC_STRING_SCHEMA,
                    }
                ),
                'hook': build_object_type(
                    properties={
                        'uid': GENERIC_STRING_SCHEMA,
                        'active': build_basic_type(OpenApiTypes.BOOL),
                        'endpoint': build_basic_type(OpenApiTypes.BOOL),
                    }
                ),
                'name': build_object_type(
                    properties={
                        'new': GENERIC_STRING_SCHEMA,
                        'old': GENERIC_STRING_SCHEMA,
                    }
                ),
                'shared_fields': build_object_type(
                    properties={
                        'added': GENERIC_ARRAY_SCHEMA,
                        'removed': GENERIC_ARRAY_SCHEMA,
                    }
                ),
            }
        )


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.history.fields.UserUrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
