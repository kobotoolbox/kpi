from rest_framework import serializers

from kobo.apps.subsequences.models import QuestionAdvancedAction


class QuestionAdvancedActionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['config']
        read_only_fields = ['question_xpath', 'action', 'asset']

    def update(self, instance, validated_data):
        config = instance.config
        languages = [obj["language"] for obj in config]
        request_config = validated_data['config']
        new = [obj for obj in request_config if obj["language"] not in languages]
        instance.config =[*config, *new]
        instance.save(update_fields=['config'])
        return instance

class QuestionAdvancedActionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedAction
        fields = ['question_xpath', 'action', 'config']
