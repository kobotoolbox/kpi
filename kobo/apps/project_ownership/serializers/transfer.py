from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models.asset import Asset
from ..models import Transfer, TransferStatus, TransferStatusTypeChoices


class TransferListSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    asset = RelativePrefixHyperlinkedRelatedField(
        view_name='asset-detail',
        lookup_field='uid',
        queryset=Asset.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
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

    def get_url(self, transfer: Transfer) -> str:
        return reverse(
            'project-ownership-transfer-detail',
            kwargs={
                'parent_lookup_invite_uid': transfer.invite.uid,
                'uid': transfer.uid,
            },
            request=self.context.get('request', None),
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
