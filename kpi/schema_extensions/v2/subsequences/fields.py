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
        if any(key in kwargs for key in ('choices', 'allow_null', 'allow_blank')):
            raise TypeError('choices/allow_null/allow_blank cannot be overridden')

        super().__init__(
            choices=ACTION_IDS,
            allow_null=False,
            allow_blank=False,
            *args,
            **kwargs,
        )
