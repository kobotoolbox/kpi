from rest_framework import serializers

from kobo.apps.subsequences.actions import ACTION_IDS


class AdvancedFeatureResponseParamsField(serializers.JSONField):
    pass


class AdvancedFeatureRequestParamsField(serializers.JSONField):
    pass


class AdvancedFeatureCreateResponseParamsField(serializers.JSONField):
    pass


AdvancedFeatureActionField = serializers.ChoiceField(
    choices=ACTION_IDS, allow_null=False, allow_blank=False
)
