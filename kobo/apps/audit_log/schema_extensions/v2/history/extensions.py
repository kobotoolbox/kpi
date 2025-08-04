from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class ActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.history.fields.ActionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.STR))


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.history.fields.MetadataField'
    )

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
                                ),
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
                                    properties={}
                                ),
                                'old': build_object_type(
                                    properties={}
                                ),
                            }
                        ),
                    }
                ),
                'asset_uid': build_basic_type(OpenApiTypes.STR),
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


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.audit_log.schema_extensions.v2.history.fields.UserUrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('user-kpi-detail', username='bob')
