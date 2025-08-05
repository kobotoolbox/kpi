from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    LABEL_VALUE_OBJECT_SCHEMA,
    GENERIC_ARRAY_SCHEMA,
    USER_URL_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.AuditLogMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': build_basic_type(OpenApiTypes.STR),
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
                'auth_type': GENERIC_STRING_SCHEMA,
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


class ProjectHistoryMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.ProjectHistoryMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': GENERIC_STRING_SCHEMA,
                'asset_uid': GENERIC_STRING_SCHEMA,
                'ip_address': GENERIC_STRING_SCHEMA,
                'cloned_from': GENERIC_STRING_SCHEMA,
                'log_subtype': GENERIC_STRING_SCHEMA,
                'paired-data': build_object_type(
                    properties={
                        'fields': GENERIC_ARRAY_SCHEMA,
                        'source_uid': GENERIC_STRING_SCHEMA,
                        'source_name': GENERIC_STRING_SCHEMA,
                    }
                ),
                'username': GENERIC_STRING_SCHEMA,
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
                'project_owner': GENERIC_STRING_SCHEMA,
                'latest_version_uid': GENERIC_STRING_SCHEMA,
                'submission': build_object_type(
                    properties={
                        'root_uuid': GENERIC_STRING_SCHEMA,
                        'submitted_by': GENERIC_STRING_SCHEMA,
                        'status': GENERIC_STRING_SCHEMA,
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


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.UserField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
