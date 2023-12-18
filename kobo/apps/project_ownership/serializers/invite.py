from constance import config
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max, Prefetch
from django.utils.translation import gettext as _
from rest_framework import exceptions, serializers

from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models import Asset

from .transfer import TransferListSerializer
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
        view_name='project-ownership-invite-detail',
    )

    recipient = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
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
            'recipient',
            'status',
            'date_created',
            'date_modified',
            'transfers',
            'assets',
        )

    def create(self, validated_data: dict) -> Invite:
        request = self.context['request']

        with transaction.atomic():
            instance = Invite.objects.create(
                sender=request.user,
                recipient=validated_data['recipient']
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

        if config.PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES:
            instance = self.update(
                instance, {'status': InviteStatusChoices.ACCEPTED.value}
            )

        return instance

    def get_transfers(self, invite: Invite) -> list:
        transfers = (
            invite.transfers.select_related('asset')
            .only('asset__uid')
            .prefetch_related(
                Prefetch(
                    'statuses',
                    queryset=TransferStatus.objects.filter(
                        status_type=TransferStatusTypeChoices.GLOBAL.value
                    ),
                    to_attr='prefetched_status',
                ),
            )
        )

        return TransferListSerializer(
            transfers, many=True, context=self.context
        ).data

    def get_date_created(self, invite: Invite) -> str:
        return invite.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_date_modified(self, invite: Invite) -> str:
        return invite.date_modified.strftime('%Y-%m-%dT%H:%M:%SZ')

    def validate_assets(self, asset_uids: list[str]) -> list[Asset]:
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

        max_transfer_ids_per_asset = [
            r['pk__max']
            for r in (
                Transfer.objects.values('asset')
                .annotate(Max('pk'))
                .filter(asset__in=assets)
                .order_by()
            )
        ]

        queryset = Transfer.objects.filter(
            pk__in=max_transfer_ids_per_asset, invite__sender=request.user
        )

        errors = []
        # Validate whether the asset does not belong to an invite that has been
        # already processed. We only accept re-invitations on projects for which
        # the invitation was declined or cancelled.
        for transfer in queryset:
            if transfer.invite.status not in [
                InviteStatusChoices.DECLINED.value,
                InviteStatusChoices.CANCELLED.value,
            ]:
                errors.append(
                    _(
                        'Project `##asset_uid##` cannot be transferred. '
                        'Current status: ##status##'
                    )
                    .replace('##asset_uid##', transfer.asset.uid)
                    .replace('##status##', transfer.invite.status)
                )

        if errors:
            raise serializers.ValidationError(errors)

        return assets

    def validate_recipient(self, user: 'auth.User') -> 'auth.User':
        if self.instance is None:
            return user

        raise serializers.ValidationError(_(
            'This field cannot be modified'
        ))

    def validate_status(self, status: str) -> str:
        if (
            self.instance is None and status
            or self.instance.status != InviteStatusChoices.PENDING.value
        ):
            raise serializers.ValidationError(_(
                'This field cannot be modified'
            ))

        request = self.context['request']

        if not (
            request.user == self.instance.recipient
            and status
            in [
                InviteStatusChoices.DECLINED.value,
                InviteStatusChoices.ACCEPTED.value,
            ]
            or (
                request.user == self.instance.sender
                and status == InviteStatusChoices.CANCELLED.value
            )
        ):
            raise exceptions.PermissionDenied()

        return status

    def update(self, instance: Invite, validated_data: dict) -> Invite:

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
