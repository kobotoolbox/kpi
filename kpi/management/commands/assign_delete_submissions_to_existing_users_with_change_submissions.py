# -*- coding: utf-8 -*-
import sys

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.db.migrations.recorder import MigrationRecorder

from kpi.constants import PERM_CHANGE_SUBMISSIONS, PERM_DELETE_SUBMISSIONS
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission


class Command(BaseCommand):

    help = 'Assign `delete_submissions` permission to users ' \
           'who already had `change_submissions` prior to migration ' \
           '`0024_add_date_created_to_object_permission`'

    def handle(self, *args, **options):

        verbosity = options['verbosity']

        migration_name = '0024_add_date_created_to_object_permission'
        try:
            expected_migration = MigrationRecorder.Migration.objects.get(
                app='kpi',
                name__startswith=migration_name)
        except MigrationRecorder.Migration.DoesNotExist:
            self.stdout.write(f'You must run migration `{migration_name}` first')
            sys.exit(1)

        applied_date = expected_migration.applied
        asset_content_type_id = ContentType.objects.get_for_model(Asset).pk
        query = ObjectPermission.objects.filter(
            content_type_id=asset_content_type_id,
            permission__codename=PERM_CHANGE_SUBMISSIONS,
            date_created__lte=applied_date
        ).select_related('user', 'permission')

        records_count = query.count()
        cpt = 1
        if verbosity >= 1:
            self.stdout.write(f'Found {records_count} permission assignments')

        for record in query.iterator():
            try:
                asset = Asset.objects.get(pk=record.object_id)
            except Asset.DoesNotExist:
                asset_id = record.object_id
                if verbosity >= 2:
                    sys.stderr.write(f'\n\tAsset with id {asset_id} could not be found')
                cpt += 1
                continue

            asset.assign_perm(record.user, PERM_DELETE_SUBMISSIONS)
            if verbosity >= 2:
                sys.stdout.write(
                    '\n\tGranted `{codename}` to '
                    '`{username}` on Asset: `{asset}`'.format(
                        codename=PERM_DELETE_SUBMISSIONS,
                        username=record.user.username,
                        asset=str(asset)
                    ))
            if verbosity >= 1:
                progress = f'\nUpdated {cpt}/{records_count} records...'
                sys.stdout.write(progress)
                sys.stdout.flush()

            cpt += 1

        self.stdout.write('\nDone!')
