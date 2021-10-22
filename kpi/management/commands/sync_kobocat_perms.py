# coding: utf-8
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand

from kpi.constants import PERM_FROM_KC_ONLY
from kpi.models import Asset, ObjectPermission
from kpi.deployment_backends.kc_access.utils import (
    assign_applicable_kc_permissions
)
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatUserObjectPermission
)
from kpi.management.commands.sync_kobocat_xforms import _sync_permissions


class Command(BaseCommand):

    help = (
        "Synchronize permissions of deployed forms with KoBoCAT.\n"
        "They are synced bidirectionally unless `--mirror-kpi` option is used."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            action='store',
            dest='asset_uid',
            default=None,
            help="Sync only a specific asset's form-media",
        )
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=None,
            help="Sync only a specific user's form-media for assets that they own",
        )
        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Update records by batch of `chunks`.",
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            dest='quiet',
            default=False,
            help='Do not output status messages',
        )
        parser.add_argument(
            '--mirror-kpi',
            action='store_true',
            dest='mirror_kpi',
            default=False,
            help='Mirror KPI permissions only',
        )

        super().add_arguments(parser)

    def handle(self, *args, **options):
        self._verbosity = options['verbosity']
        self._username = options['username']
        self._quiet = options['quiet']
        self._asset_uid = options['asset_uid']
        self._chunks = options['chunks']

        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )
        self._sync_perms(**options)

    def _sync_perms(self, **options):
        assets = Asset.objects.only('id', 'uid', 'owner').filter(
            _deployment_data__active=True
        )
        if self._username:
            assets = assets.filter(owner__username=self._username)
        if self._asset_uid:
            assets = assets.filter(uid=self._asset_uid)

        assets = assets.order_by('owner__username')

        for asset in assets.iterator(chunk_size=self._chunks):
            if not self._quiet:
                self.stdout.write('')
                self.stdout.write(
                    f'Processing asset {asset.uid} (owner: {asset.owner.username})'
                )
                self.stdout.write('')

            if options['mirror_kpi']:

                kc_user_obj_perm_qs = (
                    KobocatUserObjectPermission.objects.filter(
                        object_pk=asset.deployment.xform_id
                    ).exclude(user_id=asset.owner_id)
                )
                if kc_user_obj_perm_qs.exists():
                    if not self._quiet and self._verbosity >= 1:
                        self.stdout.write(
                            f'\tDeleting all KoBoCAT permissions...'
                        )
                    kc_user_obj_perm_qs.delete()

                self._copy_perms_from_kpi_kc(asset)
            else:

                if not self._quiet and self._verbosity >= 1:
                    self.stdout.write(
                        f'\tPulling permissions from KoBoCAT...'
                    )
                affected_users = _sync_permissions(asset, asset.deployment.xform)
                if self._verbosity >= 2 and affected_users:
                    self.stdout.write(
                        f'\t\tAffected users: {affected_users}'
                    )

                self._copy_perms_from_kpi_kc(asset)

        if not self._quiet and self._verbosity >= 1:
            self.stdout.write('')
            self.stdout.write(
                f'Deleting `{PERM_FROM_KC_ONLY}` permission from KPI...'
            )
        deleted = ObjectPermission.objects.filter(
            permission__codename=PERM_FROM_KC_ONLY
        ).delete()

        if not self._quiet and self._verbosity >= 2:
            self.stdout.write(f'\t {deleted[0]} objects')

        if not self._quiet:
            self.stdout.write('Done!')

    def _copy_perms_from_kpi_kc(self, asset: Asset):
        codenames = []
        current_user = None
        kpi_perms = asset.permissions.exclude(
            permission__codename=PERM_FROM_KC_ONLY
        ).order_by('user_id')
        for perm in kpi_perms:
            # Skip the copy if user is the owner
            if perm.user == asset.owner:
                continue

            if current_user != perm.user:
                if current_user is not None:
                    self._copy_user_perms_from_kpi_kc(
                        asset, current_user, codenames
                    )
                codenames = [perm.permission.codename]
            else:
                codenames.append(perm.permission.codename)
            current_user = perm.user

        if codenames:
            self._copy_user_perms_from_kpi_kc(asset, current_user, codenames)

    def _copy_user_perms_from_kpi_kc(
        self, asset: Asset, user: 'auth.User', codenames: list
    ):
        if not self._quiet:
            if self._verbosity >= 1:
                self.stdout.write(
                    f'\tPushing permissions for user `{user}` to KoBoCAT...'
                )
            if self._verbosity >= 2:
                self.stdout.write(
                    f'\t\tPermissions: {codenames}'
                )
        assign_applicable_kc_permissions(
            asset, user, codenames
        )
