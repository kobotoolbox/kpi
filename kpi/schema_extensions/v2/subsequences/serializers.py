from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import AdvancedFeatureActionField, AdvancedFeatureParamsField

AdvancedFeatureResponse = inline_serializer_class(
    name='AdvancedFeatureResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField,
        'params': AdvancedFeatureParamsField(),
        'uid': serializers.CharField(),
    },
)

AdvancedFeaturePatchRequest = inline_serializer_class(
    name='AdvancedFeaturePatchRequest', fields={'params': AdvancedFeatureParamsField()}
)

AdvancedFeaturePostRequest = inline_serializer_class(
    name='AdvancedFeaturePostRequest',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField,
        'params': AdvancedFeatureParamsField(),
    },
)
