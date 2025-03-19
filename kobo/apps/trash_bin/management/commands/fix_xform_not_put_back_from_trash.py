from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = 'Restored XForms are still marked as deleted when retrieved from the trash'

    def handle(self, *args, **options):

        verbosity = options['verbosity']

        # Retrieve all XForms marked as deleted
        pending_delete_xf_kpi_asset_uids = list(
            XForm.all_objects.filter(pending_delete=True).values_list(
                'kpi_asset_uid', flat=True
            )
        )

        # Retrieve all Asset within the previous list, not marked as deleted
        mismatched_asset_uids = list(
            Asset.all_objects.filter(
                pending_delete=False, uid__in=pending_delete_xf_kpi_asset_uids
            ).values_list('uid', flat=True)
        )

        if not mismatched_asset_uids:
            if verbosity >= 1:
                self.stdout.write('No mismatched assets found!')
            return

        mismatched_asset_uid_count = len(mismatched_asset_uids)
        if verbosity > 1:
            self.stdout.write(
                f'Found {mismatched_asset_uid_count} mismatched assets'
            )

        # Updated XForms
        updated = XForm.all_objects.filter(
            pending_delete=True, kpi_asset_uid__in=mismatched_asset_uids
        ).update(pending_delete=False)

        if updated == mismatched_asset_uid_count:
            self.stdout.write(f'{updated} XForms restored!')
        else:
            self.stderr.write(
                f'Updated XForms ({updated}) count does not match '
                f'mismatched Assets ({mismatched_asset_uid_count})'
            )
