from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ContentField,
    ContentHashField,
    DateDeployedField,
    DateModifiedField,
    UidField,
    UrlField,
)


VersionListResponse = inline_serializer_class(
    name='VersionListResponse',
    fields={
        'uid': UidField(),
        'url': UrlField(),
        'content_hash': ContentHashField(),
        'date_deployed': DateDeployedField(),
        'date_modified': DateModifiedField(),
    },
)


VersionRetrieveResponse = inline_serializer_class(
    name='VersionRetrieveResponse',
    fields={
        'uid': UidField(),
        'url': UrlField(),
        'content_hash': ContentHashField(),
        'date_deployed': DateDeployedField(),
        'date_modified': DateModifiedField(),
        'content': ContentField(),
    },
)
