import jsonschema.exceptions
from rest_framework import serializers

from kobo.apps.subsequences.models import QuestionAdvancedAction


class QuestionAdvancedActionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['config']
        read_only_fields = ['question_xpath', 'action', 'asset']

    def validate(self, attrs):
        data = super().validate(attrs)
        action = self.instance.to_action()
        try:
            action.__class__.validate_params(attrs['config'])
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data

    def update(self, instance, validated_data):
        action = instance.to_action()
        action.update_params(validated_data['config'])
        instance.config = action.params
        instance.save(update_fields=['config'])
        return instance


class QuestionAdvancedActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['question_xpath', 'action', 'config']
