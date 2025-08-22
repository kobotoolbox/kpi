from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import TOSDetailURLField

TermsOfServiceResponse = inline_serializer_class(
    name='TermsOfServiceResponse',
    fields={
        'url': TOSDetailURLField(),
        'slug': serializers.CharField(),
        'body': serializers.CharField(),
    },
)
