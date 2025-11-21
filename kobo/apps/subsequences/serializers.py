import jsonschema.exceptions
from rest_framework import serializers

from kobo.apps.subsequences.models import QuestionAdvancedAction


class QuestionAdvancedActionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['params', 'question_xpath', 'action', 'asset', 'uid']
        read_only_fields = ['question_xpath', 'action', 'asset', 'uid']

    def validate(self, attrs):
        data = super().validate(attrs)
        action = self.instance.to_action()
        try:
            action.__class__.validate_params(attrs.get('params'))
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data

    def update(self, instance, validated_data):
        action = instance.to_action()
        action.update_params(validated_data['params'])
        instance.params = action.params
        instance.save(update_fields=['params'])
        return instance


class QuestionAdvancedActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['question_xpath', 'action', 'params', 'uid']
        read_only_fields = ['uid']
