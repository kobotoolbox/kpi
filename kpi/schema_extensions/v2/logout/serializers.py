from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class


LogoutResponse = inline_serializer_class(
    name='LogoutResponse',
    fields={
        'redirect_url': serializers.CharField(
            help_text='URL to redirect to after logout',
        ),
    },
)
