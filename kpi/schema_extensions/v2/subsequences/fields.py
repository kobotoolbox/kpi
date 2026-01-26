from rest_framework import serializers

from kobo.apps.subsequences.actions import ACTION_IDS


class AdvancedFeatureResponseParamsField(serializers.JSONField):
    pass


class AdvancedFeatureRequestParamsField(serializers.JSONField):
    pass


class AdvancedFeatureCreateResponseParamsField(serializers.JSONField):
    pass


class AdvancedFeatureActionField(serializers.ChoiceField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('choices', ACTION_IDS)
        kwargs.setdefault('allow_null', False)
        kwargs.setdefault('allow_blank', False)
        super().__init__(*args, **kwargs)
