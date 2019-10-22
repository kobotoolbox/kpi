# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import sys

from django.core.management.base import BaseCommand

from kobo.apps.hook.models.hook import Hook
from kpi.exceptions import KobocatDeploymentException
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = 'Link KoBoCAT `XForm`s back to their corresponding KPI `Asset`s ' \
           'by populating the `kpi_asset_uid` field'

    def add_arguments(self, parser):
        super(Command, self).add_arguments(parser)
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

    def handle(self, *args, **options):

        rest_service_only = options['rest_service_only']
        verbosity = options['verbosity']
        force = options['force']
        username = options['username']

        query = Asset.objects
        if rest_service_only:
            query = query.exclude(hooks=None)
        if username:
            query = query.filter(owner__username=username)

        total = query.count()
        cpt = 0
        for asset in query.all():
            if asset.has_deployment:
                try:
                    if asset.deployment.set_asset_uid(force=force):
                        if verbosity >= 2:
                            print('\nAsset #{}: Patching XForm'.format(asset.id))
                        # Avoid `Asset.save()` logic. Do not touch `modified_date`
                        Asset.objects.filter(pk=asset.id).update(
                            _deployment_data=asset._deployment_data)
                    else:
                        if verbosity >= 2:
                            print('\nAsset #{}: Already populated'.format(asset.id))
                except KobocatDeploymentException as e:
                    if verbosity >= 2:
                        print('\nERROR: Asset #{}: {}'.format(asset.id,
                                                              str(e)))
            else:
                if verbosity >= 3:
                    print('\nAsset #{}: No deployment found'.format(asset.id))

            cpt += 1
            if verbosity >= 1:
                progress = '\rUpdated {cpt}/{total} records...'.format(
                    cpt=cpt,
                    total=total
                )
                sys.stdout.write(progress)
                sys.stdout.flush()

        print('\nDone!')
