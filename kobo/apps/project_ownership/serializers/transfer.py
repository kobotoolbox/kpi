from rest_framework import serializers

from ..models import Transfer, TransferStatus, TransferStatusTypeChoices


class TransferListSerializer(serializers.ModelSerializer):

    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='project-ownership-transfers-detail',
    )
    asset = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='asset-detail',
    )
    error = serializers.SerializerMethodField()
    date_modified = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = (
            'url',
            'asset',
            'status',
            'error',
            'date_modified',
        )

    def get_date_modified(self, transfer: Transfer) -> str:
        return transfer.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_error(self, transfer: Transfer) -> str:
        return transfer.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL.value
        ).error


class TransferDetailSerializer(TransferListSerializer):

    statuses = serializers.SerializerMethodField()

    class Meta(TransferListSerializer.Meta):
        fields = (
            'url',
            'asset',
            'status',
            'date_modified',
            'statuses',
        )

    def get_statuses(self,  transfer: Transfer) -> list[dict]:
        return TransferStatusSerializer(
            transfer.statuses.all(), many=True, context=self.context
        ).data


class TransferStatusSerializer(serializers.ModelSerializer):

    class Meta:
        model = TransferStatus
        fields = (
            'status',
            'status_type',
            'error',
        )
