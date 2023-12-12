from rest_framework import serializers

from ..models import Transfer, TransferStatusTypeChoices


class TransferSerializer(serializers.ModelSerializer):

    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='project-ownership-transfers-detail',
    )
    asset = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='asset-detail',
    )
    error = serializers.SerializerMethodField()
    date_created = serializers.SerializerMethodField()
    date_modified = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = (
            'url',
            'asset',
            'status',
            'error',
            'date_created',
            'date_modified',
        )

    def get_date_created(self, invite):
        return invite.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_date_modified(self, invite):
        return invite.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_error(self, transfer):
        return transfer.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL.value
        ).error
