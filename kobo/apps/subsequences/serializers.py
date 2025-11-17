import jsonschema.exceptions
from rest_framework import serializers

from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.utils.action_conversion import question_advanced_action_to_action


class QuestionAdvancedActionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['params', 'question_xpath', 'action', 'asset', 'uid']
        read_only_fields = ['question_xpath', 'action', 'asset', 'uid']

    def validate(self, attrs):
        data = super().validate(attrs)
        action = question_advanced_action_to_action(instance)
        try:
            action.__class__.validate_params(attrs['params'])
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data

    def update(self, instance, validated_data):
        action = question_advanced_action_to_action(instance)
        action.update_params(validated_data['params'])
        instance.params = action.params
        instance.save(update_fields=['params'])
        return instance


class QuestionAdvancedActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['question_xpath', 'action', 'params', 'uid']
        read_only_fields = ['uid']
