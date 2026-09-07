from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

EmailRequestPayload = inline_serializer_class(
    name='EmailRequestPayload',
    fields={
        'email': serializers.EmailField(),
        # Required only when authenticating without a browser session; a
        # session re-authenticates through allauth instead
        'current_password': serializers.CharField(required=False),
        'mfa_code': serializers.CharField(required=False),
    },
)

EmailReauthenticationRequiredResponse = inline_serializer_class(
    name='EmailReauthenticationRequiredResponse',
    fields={
        'detail': serializers.CharField(),
        'code': serializers.CharField(),
        'flows': serializers.ListField(child=serializers.DictField()),
    },
)
