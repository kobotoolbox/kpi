import jsonschema.exceptions
from rest_framework import serializers

from kobo.apps.subsequences.actions import ACTION_IDS_TO_CLASSES
from kobo.apps.subsequences.models import QuestionAdvancedFeature


class QuestionAdvancedFeatureUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedFeature
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


class QuestionAdvancedFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedFeature
        fields = ['question_xpath', 'action', 'params', 'uid']
        read_only_fields = ['uid']

    def create(self, validated_data):
        xpath = validated_data.get('question_xpath')
        action = validated_data.get('action')
        asset = validated_data.get('asset')
        # prevent unique_together error and give a better error message
        if QuestionAdvancedFeature.objects.filter(
            asset=asset, question_xpath=xpath, action=action
        ).exists():
            raise serializers.ValidationError('Action for this question already exists')
        return super().create(validated_data)

    def validate(self, attrs):
        data = super().validate(attrs)
        Action = ACTION_IDS_TO_CLASSES[attrs.get('action')]
        try:
            Action.validate_params(attrs.get('params'))
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data
