from __future__ import annotations

from django.utils.translation import gettext as t
from rest_framework import serializers

from kobo.apps.project_ownership.models import Transfer
from kpi.utils.object_permission import get_database_user
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
    always_display_as_new = serializers.ReadOnlyField()
    title = serializers.SerializerMethodField()
    snippet = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    html = serializers.SerializerMethodField()

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
            'always_display_as_new',
        )
        read_only_fields = ('uid',)

    def get_title(self, in_app_message: InAppMessage) -> str:
        if not in_app_message.generic_related_objects:
            return in_app_message.title
        return self._replace_placeholders(in_app_message, in_app_message.title)

    def get_snippet(self, in_app_message: InAppMessage) -> str:
        if not in_app_message.generic_related_objects:
            return in_app_message.snippet
        return self._replace_placeholders(in_app_message, in_app_message.snippet)

    def get_body(self, in_app_message: InAppMessage) -> str:
        if not in_app_message.generic_related_objects:
            return in_app_message.body
        return self._replace_placeholders(in_app_message, in_app_message.body)

    def get_html(self, in_app_message: InAppMessage) -> dict:
        if not in_app_message.generic_related_objects:
            return in_app_message.html

        return {
            'snippet': self._replace_placeholders(
                in_app_message, in_app_message.html['snippet']
            ),
            'body': self._replace_placeholders(
                in_app_message, in_app_message.html['body']
            ),
        }

    def _replace_placeholders(
        self, in_app_message: InAppMessage, value: str
    ) -> str:
        # This method only support transfers so far
        transfer_identifier = (
            f'{Transfer._meta.app_label}.{Transfer._meta.model_name}'
        )
        if transfer_identifier in in_app_message.generic_related_objects:
            transfer_id = in_app_message.generic_related_objects[transfer_identifier]
            return self._replace_placeholders_for_transfer(value, transfer_id)

        return t(value)

    def _replace_placeholders_for_transfer(self, value: str, transfer_id: int):
        request = self.context['request']
        user = get_database_user(request.user)
        value = t(value)

        try:
            transfer = Transfer.objects.get(pk=transfer_id)
        except Transfer.DoesNotExist:
            return value

        value = value.replace('##username##', user.username)
        value = value.replace('##project_name##', transfer.asset.name)
        value = value.replace('##previous_owner##', transfer.invite.sender.username)
        value = value.replace('##new_owner##', transfer.invite.recipient.username)

        return value
