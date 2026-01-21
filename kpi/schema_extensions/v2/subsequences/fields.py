from rest_framework import serializers

from kobo.apps.subsequences.actions import ACTION_IDS


class AdvancedFeatureParamsField(serializers.JSONField):
    pass


AdvancedFeatureActionField = serializers.ChoiceField(
    choices=ACTION_IDS, allow_null=False, allow_blank=False
)
