from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

EmailRequestPayload = inline_serializer_class(
    name='EmailRequestPayload',
    fields={
        'email': serializers.EmailField(),
    },
)

EmailConfirmationRequestPayload = inline_serializer_class(
    name='EmailConfirmationRequestPayload',
    fields={
        'email': serializers.EmailField(),
    },
)

EmailConfirmationRequestResponse = inline_serializer_class(
    name='EmailConfirmationRequestResponse',
    fields={
        'detail': serializers.CharField(),
    },
)
