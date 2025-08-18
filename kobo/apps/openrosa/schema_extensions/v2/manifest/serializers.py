from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    OpenRosaFormManifestURLField,
)


OpenRosaFormManifestResponse = inline_serializer_class(
    name='OpenRosaFormManifestResponse',
    fields={
        'filename': serializers.CharField(),
        'hash': serializers.CharField(),
        'downloadUrl': OpenRosaFormManifestURLField(),
    },
)
