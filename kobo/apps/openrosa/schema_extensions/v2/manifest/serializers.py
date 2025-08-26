from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

OpenRosaFormManifestResponse = inline_serializer_class(
    name='OpenRosaFormManifestResponse',
    fields={
        'filename': serializers.CharField(),
        'hash': serializers.CharField(),
        'downloadUrl': serializers.URLField(),
    },
)
