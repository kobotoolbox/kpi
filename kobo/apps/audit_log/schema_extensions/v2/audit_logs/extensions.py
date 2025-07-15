from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


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
                                'new': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                                'old': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                )
                            }
                        ),
                        'country': build_object_type(
                            properties={
                                'added': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                                'removed': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                            }
                        ),
                        'description': build_object_type(
                            properties={
                                'new': build_basic_type(OpenApiTypes.STR),
                                'old': build_basic_type(OpenApiTypes.STR),
                            }
                        ),
                        'country_codes': build_object_type(
                            properties={
                                'added': build_array_type(
                                    schema=build_basic_type(OpenApiTypes.STR)
                                ),
                                'removed': build_array_type(
                                    schema=build_basic_type(OpenApiTypes.STR)
                                ),
                            }
                        ),
                        'data-table': build_object_type(
                            properties={
                                'new': build_object_type(
                                    properties={
                                        'sort-by': build_object_type(
                                            properties={
                                                'value': build_basic_type(OpenApiTypes.STR),
                                                'fieldId': build_basic_type(OpenApiTypes.STR),
                                            }
                                        ),
                                        'frozen-column': build_basic_type(OpenApiTypes.STR),
                                        'show-hxl-tags': build_basic_type(OpenApiTypes.BOOL),
                                        'show-group-name': build_basic_type(OpenApiTypes.BOOL),
                                        'selected-columns': build_array_type(
                                            schema=build_basic_type(OpenApiTypes.STR)
                                        ),
                                        'translation-index': build_basic_type(OpenApiTypes.INT),
                                    }
                                ),
                                'old': build_object_type(
                                    properties={
                                        'sort-by': build_object_type(
                                            properties={
                                                'value': build_basic_type(OpenApiTypes.STR),
                                                'fieldId': build_basic_type(OpenApiTypes.STR),
                                            }
                                        ),
                                        'frozen-column': build_basic_type(OpenApiTypes.STR),
                                        'show-hxl-tags': build_basic_type(OpenApiTypes.BOOL),
                                        'show-group-name': build_basic_type(OpenApiTypes.BOOL),
                                        'selected-columns': build_array_type(
                                            schema=build_basic_type(OpenApiTypes.STR)
                                        ),
                                        'translation-index': build_basic_type(OpenApiTypes.INT),
                                    }
                                ),
                            }
                        ),
                    }
                ),
                'asset_uid': build_basic_type(OpenApiTypes.STR),
                'auth_type': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
                'log_subtype': build_basic_type(OpenApiTypes.STR),
                'project_owner': build_basic_type(OpenApiTypes.STR),
                'latest_version_uid': build_basic_type(OpenApiTypes.STR),
                'asset-files': build_object_type(
                    properties={
                        'uid': build_basic_type(OpenApiTypes.STR),
                        'filename': build_basic_type(OpenApiTypes.STR),
                        'md5_hash': build_basic_type(OpenApiTypes.STR),
                        'download_url': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'permissions': build_object_type(
                    properties={
                        'added': build_array_type(
                            schema=build_basic_type(OpenApiTypes.STR)
                        ),
                        'removed': build_array_type(
                            schema=build_basic_type(OpenApiTypes.STR)
                        ),
                        'username': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'latest_deployed_version_uid': build_basic_type(OpenApiTypes.STR),
                'submission': build_object_type(
                    properties={
                        'root_uuid': build_basic_type(OpenApiTypes.STR),
                        'submitted_by': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'hook': build_object_type(
                    properties={
                        'uid': build_basic_type(OpenApiTypes.STR),
                        'active': build_basic_type(OpenApiTypes.BOOL),
                        'endpoint': build_basic_type(OpenApiTypes.BOOL),
                    }
                ),
                'name': build_object_type(
                    properties={
                        'new': build_basic_type(OpenApiTypes.STR),
                        'old': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'shared_fields': build_object_type(
                    properties={
                        'added': build_array_type(build_basic_type(OpenApiTypes.STR)),
                        'removed': build_array_type(build_basic_type(OpenApiTypes.STR)),
                    }
                ),
            }
        )


class ProjectHistoryMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.ProjectHistoryMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': build_basic_type(OpenApiTypes.STR),
                'asset_uid': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
                'cloned_from': build_basic_type(OpenApiTypes.STR),
                'log_subtype': build_basic_type(OpenApiTypes.STR),
                'paired-data': build_object_type(
                    properties={
                        'fields': build_array_type(build_basic_type(OpenApiTypes.STR)),
                        'source_uid': build_basic_type(OpenApiTypes.STR),
                        'source_name': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'username': build_basic_type(OpenApiTypes.STR),
                'settings': build_object_type(
                    properties={
                        'sector': build_object_type(
                            properties={
                                'new': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                                'old': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                )
                            }
                        ),
                        'country': build_object_type(
                            properties={
                                'added': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                                'removed': build_object_type(
                                    properties={
                                        'label': build_basic_type(OpenApiTypes.STR),
                                        'value': build_basic_type(OpenApiTypes.STR),
                                    }
                                ),
                            }
                        ),
                        'description': build_object_type(
                            properties={
                                'new': build_basic_type(OpenApiTypes.STR),
                                'old': build_basic_type(OpenApiTypes.STR),
                            }
                        ),
                        'country_codes': build_object_type(
                            properties={
                                'added': build_array_type(
                                    schema=build_basic_type(OpenApiTypes.STR)
                                ),
                                'removed': build_array_type(
                                    schema=build_basic_type(OpenApiTypes.STR)
                                ),
                            }
                        ),
                        'data-table': build_object_type(
                            properties={
                                'new': build_object_type(
                                    properties={
                                        'sort-by': build_object_type(
                                            properties={
                                                'value': build_basic_type(OpenApiTypes.STR),
                                                'fieldId': build_basic_type(OpenApiTypes.STR),
                                            }
                                        ),
                                        'frozen-column': build_basic_type(OpenApiTypes.STR),
                                        'show-hxl-tags': build_basic_type(OpenApiTypes.BOOL),
                                        'show-group-name': build_basic_type(OpenApiTypes.BOOL),
                                        'selected-columns': build_array_type(
                                            schema=build_basic_type(OpenApiTypes.STR)
                                        ),
                                        'translation-index': build_basic_type(OpenApiTypes.INT),
                                    }
                                ),
                                'old': build_object_type(
                                    properties={
                                        'sort-by': build_object_type(
                                            properties={
                                                'value': build_basic_type(OpenApiTypes.STR),
                                                'fieldId': build_basic_type(OpenApiTypes.STR),
                                            }
                                        ),
                                        'frozen-column': build_basic_type(OpenApiTypes.STR),
                                        'show-hxl-tags': build_basic_type(OpenApiTypes.BOOL),
                                        'show-group-name': build_basic_type(OpenApiTypes.BOOL),
                                        'selected-columns': build_array_type(
                                            schema=build_basic_type(OpenApiTypes.STR)
                                        ),
                                        'translation-index': build_basic_type(OpenApiTypes.INT),
                                    }
                                ),
                            }
                        ),
                    }
                ),
                'asset-files': build_object_type(
                    properties={
                        'uid': build_basic_type(OpenApiTypes.STR),
                        'filename': build_basic_type(OpenApiTypes.STR),
                        'md5_hash': build_basic_type(OpenApiTypes.STR),
                        'download_url': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'permissions': build_object_type(
                    properties={
                        'added': build_array_type(
                            schema=build_basic_type(OpenApiTypes.STR)
                        ),
                        'removed': build_array_type(
                            schema=build_basic_type(OpenApiTypes.STR)
                        ),
                        'username': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'project_owner': build_basic_type(OpenApiTypes.STR),
                'auth_type': build_basic_type(OpenApiTypes.STR),
                'latest_version_uid': build_basic_type(OpenApiTypes.STR),
                'submission': build_object_type(
                    properties={
                        'root_uuid': build_basic_type(OpenApiTypes.STR),
                        'submitted_by': build_basic_type(OpenApiTypes.STR),
                        'status': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'hook': build_object_type(
                    properties={
                        'uid': build_basic_type(OpenApiTypes.STR),
                        'active': build_basic_type(OpenApiTypes.BOOL),
                        'endpoint': build_basic_type(OpenApiTypes.BOOL),
                    }
                ),
                'name': build_object_type(
                    properties={
                        'new': build_basic_type(OpenApiTypes.STR),
                        'old': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'shared_fields': build_object_type(
                    properties={
                        'added': build_array_type(build_basic_type(OpenApiTypes.STR)),
                        'removed': build_array_type(build_basic_type(OpenApiTypes.STR)),
                    }
                ),
            }
        )


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.UserField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:user-kpi-detail', username='bob')
