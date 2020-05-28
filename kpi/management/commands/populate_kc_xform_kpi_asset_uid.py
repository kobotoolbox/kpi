# -*- coding: utf-8 -*-
import sys

from django.core.management.base import BaseCommand

from kpi.exceptions import KobocatDeploymentException
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = 'Link KoBoCAT `XForm`s back to their corresponding KPI `Asset`s ' \
           'by populating the `kpi_asset_uid` field'

    def __init__(self, stdout=None, stderr=None, no_color=False):
        super().__init__(stdout=stdout, stderr=stderr, no_color=no_color)
        self.__total = 0
        self.__cpt = 0

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

        query = self._get_queryset(options)
        self.__total = query.count()
        self._get_next_chunk(options)

        self.stdout.write('\nDone!')

    def _get_next_chunk(self, options, last_id=None):

        chunks = options["chunks"]
        verbosity = options['verbosity']
        force = options['force']

        query = self._get_queryset(options, last_id)
        assets = query.all().order_by()[:chunks]

        if assets.exists():
            last_id = None
            for asset in assets:
                if asset.has_deployment:
                    try:
                        if asset.deployment.set_asset_uid(force=force):
                            if verbosity >= 2:
                                self.stdout.write('\nAsset #{}: Patching XForm'.format(asset.id))
                            # Avoid `Asset.save()` logic. Do not touch `modified_date`
                            Asset.objects.filter(pk=asset.id).update(
                                _deployment_data=asset._deployment_data)
                        else:
                            if verbosity >= 2:
                                self.stdout.write('\nAsset #{}: Already populated'.format(asset.id))
                    except KobocatDeploymentException as e:
                        if verbosity >= 2:
                            self.stdout.write('\nERROR: Asset #{}: {}'.format(asset.id,
                                                                              str(e)))
                else:
                    if verbosity >= 3:
                        self.stdout.write('\nAsset #{}: No deployments found'.format(asset.id))

                self.__cpt += 1
                if verbosity >= 1:
                    progress = '\rUpdated {cpt}/{total} records...'.format(
                        cpt=self.__cpt,
                        total=self.__total
                    )
                    self.stdout.write(progress)
                    self.stdout.flush()

                last_id = asset.id

            self._get_next_chunk(options, last_id)

    def _get_queryset(self, options, last_id=None):

        rest_service_only = options['rest_service_only']
        username = options['username']

        query = Asset.objects
        if rest_service_only:
            query = query.exclude(hooks=None)
        if username:
            query = query.filter(owner__username=username)

        if last_id:
            query = query.filter(pk__gt=last_id)

        return query
