from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ContentField,
)

VersionListResponse = inline_serializer_class(
    name='VersionListResponse',
    fields={
    },
)
