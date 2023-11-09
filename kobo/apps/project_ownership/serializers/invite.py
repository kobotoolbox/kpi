from django.contrib.auth import get_user_model
from rest_framework import serializers

from ..models import Invite, InviteStatus


class InviteSerializer(serializers.ModelSerializer):

    source_user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-detail'
    )
    status = serializers.SerializerMethodField()
    date_created = serializers.SerializerMethodField()
    date_modified = serializers.SerializerMethodField()
    transfers = serializers.SerializerMethodField()

    class Meta:
        model = Invite
        fields = (
            'destination_user',
            'status',
            'date_created',
            'date_modified',
        )

    def get_transfers(self, invite):
        return []

    def get_date_created(self, invite):
        return invite.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_date_modified(self, invite):
        return invite.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_status(self, invite):
        return InviteStatus(invite.status).value
