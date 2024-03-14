from __future__ import annotations

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
    asset__name = serializers.SerializerMethodField()
    error = serializers.SerializerMethodField()
    date_modified = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = (
            'url',
            'asset',
            'asset__name',
            'status',
            'error',
            'date_modified',
        )

    def get_asset__name(self, transfer: Transfer) -> str:
        return transfer.asset.name

    def get_date_modified(self, transfer: Transfer) -> str:
        return transfer.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_error(self, transfer: Transfer) -> str:
        return transfer.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL
        ).error

    def get_status(self, transfer: Transfer) -> str:

        # Use prefetched attributes if they are present instead of querying the
        # DB one more time.

        # From the invite endpoints
        if hasattr(transfer, 'prefetched_status'):
            # return the first one because we only fetch GLOBAL status,
            return transfer.prefetched_status[0].status

        # From the transfer detail endpoint
        if hasattr(transfer, 'prefetched_statuses'):
            for status in transfer.prefetched_statuses:
                if status.status_type == TransferStatusTypeChoices.GLOBAL:
                    return status.status

        return transfer.status

    def get_url(self, transfer: Transfer) -> str:
        return reverse(
            'project-ownership-transfer-detail',
            kwargs={
                'parent_lookup_invite_uid': transfer.invite.uid,
                'uid': transfer.uid,
            },
            request=self.context.get('request', None),
        )


class TransferDetailSerializer(TransferListSerializer):

    statuses = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

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
            transfer.prefetched_statuses, many=True, context=self.context
        ).data


class TransferStatusSerializer(serializers.ModelSerializer):

    class Meta:
        model = TransferStatus
        fields = (
            'status',
            'status_type',
            'error',
        )
