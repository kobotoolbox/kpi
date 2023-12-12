from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.utils.translation import gettext as _
from rest_framework import exceptions, serializers

from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models import Asset
from kpi.urls.router_api_v2 import URL_NAMESPACE

from .transfer import TransferSerializer
from ..models import (
    Invite,
    InviteStatusChoices,
    Transfer,
    TransferStatus,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)


class InviteSerializer(serializers.ModelSerializer):

    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='project-ownership-invites-detail',
    )

    destination_user = RelativePrefixHyperlinkedRelatedField(
        view_name=f'{URL_NAMESPACE}:user-detail',
        lookup_field='username',
        queryset=get_user_model().objects.filter(is_active=True),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    date_created = serializers.SerializerMethodField()
    date_modified = serializers.SerializerMethodField()
    transfers = serializers.SerializerMethodField()
    assets = serializers.ListField(
        write_only=True, child=serializers.CharField(), required=False
    )

    class Meta:
        model = Invite
        fields = (
            'url',
            'destination_user',
            'status',
            'date_created',
            'date_modified',
            'transfers',
            'assets',
        )

    def create(self, validated_data):
        request = self.context['request']

        with transaction.atomic():
            instance = Invite.objects.create(
                source_user=request.user,
                destination_user=validated_data['destination_user']
            )
            transfers = Transfer.objects.bulk_create(
                [
                    Transfer(invite=instance, asset=asset)
                    for asset in validated_data['assets']
                ]
            )
            statuses = []
            for transfer in transfers:
                for status_type in TransferStatusTypeChoices.values:
                    statuses.append(
                        TransferStatus(
                            transfer=transfer,
                            status_type=status_type,
                        )
                    )
            TransferStatus.objects.bulk_create(statuses)
        return instance

    def get_transfers(self, invite):
        context = {'request': self.context['request']}
        tranfers_queryset = (
            invite.transfers.select_related('asset')
            .defer('asset__content')
            .prefetch_related('statuses')
            .all()
        )
        return TransferSerializer(
            tranfers_queryset, many=True, context=context
        ).data

    def get_date_created(self, invite):
        return invite.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_date_modified(self, invite):
        return invite.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def validate_assets(self, asset_uids: list[str]):
        if self.instance is not None:
            raise serializers.ValidationError(_(
                'This field cannot be modified'
            ))

        request = self.context['request']
        assets = Asset.objects.only('pk', 'uid').filter(
            uid__in=asset_uids, owner=request.user
        )
        count = assets.count()
        if count != len(asset_uids):
            raise serializers.ValidationError(_(
                'You must be the owner of each project you want to transfer'
            ))

        # We need to retrieve the latest transfers for current user and projects,
        # because this rare case but could happen:
        #   - UserA transfers project to UserB
        #   - UserB transfers project back to UserA
        #   - UserA transfers project to UserC
        # We do want to block UserA to transfer again this project to UserC.

        max_tranfer_ids_per_asset = [
            r['pk__max']
            for r in (
                Transfer.objects.values('asset')
                .annotate(Max('pk'))
                .filter(asset__in=assets)
                .order_by()
            )
        ]

        if (
            Transfer.objects.filter(
                pk__in=max_tranfer_ids_per_asset, invite__source_user=request.user
            ).exclude(
                invite__status=InviteStatusChoices.DECLINED.value
            ).exists()
        ):
            raise serializers.ValidationError(_(
                'Some projects cannot be transferred'
            ))

        return assets

    def validate_destination_user(self, user: 'auth.User'):
        if self.instance is None:
            return user

        raise serializers.ValidationError(_(
            'This field cannot be modified'
        ))

    def validate_status(self, status):
        if (
            self.instance is None and status
            or self.instance.status != InviteStatusChoices.PENDING.value
        ):
            raise serializers.ValidationError(_(
                'This field cannot be modified'
            ))

        request = self.context['request']

        if not (
            request.user == self.instance.destination_user
            and status
            in [
                InviteStatusChoices.DECLINED.value,
                InviteStatusChoices.ACCEPTED.value,
            ]
            or (
                request.user == self.instance.source_user
                and status == InviteStatusChoices.CANCELLED.value
            )
        ):
            raise exceptions.PermissionDenied()

        return status

    def update(self, instance, validated_data):

        status = validated_data['status']

        if status == InviteStatusChoices.ACCEPTED.value:
            status = InviteStatusChoices.IN_PROGRESS.value

        instance.status = status
        instance.save(update_fields=['status', 'date_modified'])

        for transfer in instance.transfers.all():
            if status != InviteStatusChoices.IN_PROGRESS.value:
                transfer.statuses.update(
                    status=TransferStatusChoices.CANCELLED.value
                )
            else:
                transfer.process()

        return instance
