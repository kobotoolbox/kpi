# -*- coding: utf-8 -*-
import sys

from django.core.management.base import BaseCommand

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.exceptions import KobocatDeploymentException
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = 'Link KoBoCAT `XForm`s back to their corresponding KPI `Asset`s ' \
           'by populating the `kpi_asset_uid` field'

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--rest-service-only',
            action='store_true',
            default=False,
            help='Modify only `XForm`s whose corresponding `Asset`s have ' \
                 '`Hook`s (REST Services) enabled'
        )

        parser.add_argument(
            '--force',
            action='store_true',
            default=False,
            help='Rewrite `XForm.kpi_asset_uid` even if it already has a value'
        )

        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=False,
            help='Only modify `XForm`s whose corresponding `Asset`s belong ' \
                 'to a specific user'
        )

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Update records by batch of `chunks`.",
        )

    def handle(self, *args, **options):

        force = options['force']
        chunks = options["chunks"]
        verbosity = options['verbosity']
        rest_service_only = options['rest_service_only']
        username = options['username']

        # Counters
        cpt = 0
        cpt_already_populated = 0
        cpt_failed = 0
        cpt_patched = 0

        query = Asset.objects.deployed().filter(asset_type=ASSET_TYPE_SURVEY)
        if rest_service_only:
            query = query.exclude(hooks=None)
        if username:
            query = query.filter(owner__username=username)

        total = query.count()

        # Use only fields we need.
        assets = query.only('id', 'uid', '_deployment_data', 'name',
                            'parent_id', 'owner_id')

        for asset in assets.iterator(chunk_size=chunks):
            try:
                if asset.deployment.set_asset_uid(force=force):
                    if verbosity >= 2:
                        self.stdout.write(
                            '\nAsset #{}: Patching XForm'.format(asset.id))
                    # Avoid `Asset.save()` logic. Do not touch `modified_date`
                    Asset.objects.filter(pk=asset.id).update(
                        _deployment_data=asset.deployment.get_data())
                    cpt_patched += 1
                else:
                    if verbosity >= 2:
                        self.stdout.write('\nAsset #{}: Already populated'.format(asset.id))
                    cpt_already_populated += 1
            except KobocatDeploymentException as e:
                if verbosity >= 2:
                    self.stdout.write('\nERROR: Asset #{}: {}'.format(asset.id,
                                                                      str(e)))
                    cpt_failed += 1

            cpt += 1
            if verbosity >= 1:
                progress = '\rUpdated {cpt}/{total} records...'.format(
                    cpt=cpt,
                    total=total
                )
                self.stdout.write(progress)
                self.stdout.flush()

        self.stdout.write('\nSummary:')
        self.stdout.write(f'Successfully populated: {cpt_patched}')
        self.stdout.write(f'Failed: {cpt_failed}')
        if not force:
            self.stdout.write(f'Skipped (already populated): {cpt_already_populated}')

        self.stdout.write('\nDone!')
