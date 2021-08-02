# coding: utf-8
from rest_framework import serializers

from .models import InAppMessage, InAppMessageUserInteractions


class InAppMessageSerializer(serializers.ModelSerializer):
    """
    Serializes `InAppMessage`s, including a nested `interactions` field that is
    unique per-message and per-user
    """

    class InteractionsField(serializers.Field):
        """
        Provides read-write access to a unique `InAppMessageUserInteractions`
        for each requesting user
        """
        def get_attribute(self, obj):
            """ Return the whole `InAppMessage` object """
            return obj

        def to_representation(self, obj):
            """
            Given `obj`, an entire `InAppMessage` object, return
            `InAppMessageUserInteractions.interactions` corresponding to this
            `InAppMessage` and the requesting user
            """
            try:
                interactions = InAppMessageUserInteractions.objects.get(
                    message=obj,
                    user=self.context['request'].user,
                )
            except InAppMessageUserInteractions.DoesNotExist:
                return {}
            else:
                return interactions.interactions

        def to_internal_value(self, data):
            interactions, created = \
                InAppMessageUserInteractions.objects.get_or_create(
                    message=self.parent.instance,
                    user=self.context['request'].user,
                )
            try:
                interactions.interactions.update(data)
            except (TypeError, ValueError):
                raise serializers.ValidationError({
                    'interactions_field': 'Value must be a JSON object of name/value pairs.'
                })
            else:
                interactions.save()

    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='inappmessage-detail')
    interactions = InteractionsField()

    class Meta:
        model = InAppMessage
        fields = (
            'url',
            'uid',
            'title',
            'snippet',
            'body',
            'html',
            'interactions',
        )
        read_only_fields = ('uid',)
