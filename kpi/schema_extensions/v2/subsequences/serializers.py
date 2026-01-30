from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AdvancedFeatureActionField,
    AdvancedFeatureCreateResponseParamsField,
    AdvancedFeatureRequestParamsField,
    AdvancedFeatureResponseParamsField,
)

AdvancedFeatureResponse = inline_serializer_class(
    name='AdvancedFeatureResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureResponseParamsField(),
        'uid': serializers.CharField(),
    },
)

AdvancedFeatureCreateResponse = inline_serializer_class(
    name='AdvancedFeatureCreateResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureCreateResponseParamsField(),
        'uid': serializers.CharField(),
    },
)

AdvancedFeaturePatchRequest = inline_serializer_class(
    name='AdvancedFeaturePatchRequest',
    fields={
        'action': AdvancedFeatureActionField(),
        'question_xpath': serializers.CharField(),
        'params': AdvancedFeatureRequestParamsField()
    }
)

AdvancedFeaturePostRequest = inline_serializer_class(
    name='AdvancedFeaturePostRequest',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureRequestParamsField(),
    },
)
