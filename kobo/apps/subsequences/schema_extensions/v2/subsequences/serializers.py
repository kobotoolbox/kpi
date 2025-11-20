from rest_framework import serializers

from kobo.apps.subsequences.schema_extensions.v2.subsequences.fields import AdvancedFeatureParamsField
from kpi.utils.schema_extensions.serializers import inline_serializer_class

AdvancedFeatureResponse = inline_serializer_class(
    name='AdvancedFeatureResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': serializers.CharField(),
        'params': AdvancedFeatureParamsField(),
        'asset': serializers.CharField(),
    },
)
