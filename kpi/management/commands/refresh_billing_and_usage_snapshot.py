import logging
from typing import Dict, List
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connection, connections
from django.utils import timezone

from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.openrosa.apps.logger.models import XForm, DailyXFormSubmissionCounter
from kpi.models.user_reports import BillingPeriodsSnapshot, OrganizationUsageSnapshot


class CrossDatabaseUsageCalculator:
    """
    Calculator that handles cross-database usage calculations.
    This mimics the logic from ServiceUsageCalculator but works with organization-level data.
    """

    def __init__(self):
        self.kobocat_connection = connections['kobocat'] if 'kobocat' in connections.databases else connections[
            'default']

    def get_organization_effective_user_id(self, organization: Organization) -> int:
        """
        Get the effective user ID for an organization.
        For MMO: returns the organization owner's user ID
        For regular orgs: returns the organization owner's user ID
        """
        if organization.is_mmo and hasattr(organization, 'owner_user_object'):
            return organization.owner_user_object.pk

        try:
            owner_user = organization.owner.organization_user.user
            return owner_user.pk
        except AttributeError:
            # Fallback to first admin user if no explicit owner
            admin_user = organization.organization_users.filter(is_admin=True).first()
            if admin_user:
                return admin_user.user.pk

            # Last fallback to any user in the organization
            any_user = organization.organization_users.first()
            if any_user:
                return any_user.user.pk

            raise ValueError(f'No users found for organization {organization.id}')

    def calculate_cross_database_usage_batch(
        self,
        organizations: List[Organization],
        billing_dates: Dict[int, Dict]
    ) -> Dict[int, Dict]:
        """
        Calculate usage data for multiple organizations from kobocat database.
        Returns dict with organization_id as key and usage data as value.
        """
        if not organizations:
            return {}

        # Get effective user IDs for all organizations
        org_user_map = {}
        for org in organizations:
            try:
                effective_user_id = self.get_organization_effective_user_id(org)
                org_user_map[org.id] = {
                    'effective_user_id': effective_user_id,
                    'organization': org,
                    'billing_dates': billing_dates.get(org.id, {})
                }
            except ValueError as e:
                logging.warning(f'Could not determine effective user for org {org.id}: {e}')
                continue

        if not org_user_map:
            return {}

        # Get all effective user IDs
        effective_user_ids = [data['effective_user_id'] for data in org_user_map.values()]

        # Calculate usage data from kobocat database
        storage_data = self._get_storage_usage_batch(effective_user_ids)
        submission_data = self._get_submission_usage_batch(effective_user_ids, billing_dates)

        # Combine data by organization
        result = {}
        for org_id, org_data in org_user_map.items():
            effective_user_id = org_data['effective_user_id']

            result[org_id] = {
                'effective_user_id': effective_user_id,
                'storage_bytes_total': storage_data.get(effective_user_id, 0),
                'submission_counts_all_time': submission_data.get(effective_user_id, {}).get('all_time', 0),
                'current_period_submissions': submission_data.get(effective_user_id, {}).get('current_period', 0),
                'billing_period_start': org_data['billing_dates'].get('start'),
                'billing_period_end': org_data['billing_dates'].get('end'),
            }

        return result

    def _get_storage_usage_batch(self, user_ids: List[int]) -> Dict[int, int]:
        if not user_ids or not XForm:
            return {}

        try:
            with self.kobocat_connection.cursor() as cursor:
                cursor.execute("""
                    SELECT user_id, COALESCE(SUM(attachment_storage_bytes), 0) as total_bytes
                    FROM logger_xform
                    WHERE user_id = ANY(%s) AND pending_delete = FALSE
                    GROUP BY user_id
                """, [user_ids])

                return {row[0]: row[1] for row in cursor.fetchall()}

        except Exception as e:
            logging.error(f"Error calculating storage usage: {e}")
            return {}

    def _get_submission_usage_batch(
        self,
        user_ids: List[int],
        billing_dates: Dict[int, Dict]
    ) -> Dict[int, Dict]:
        if not user_ids or not DailyXFormSubmissionCounter:
            return {}

        try:
            with self.kobocat_connection.cursor() as cursor:
                # All-time submissions
                cursor.execute("""
                    SELECT user_id, COALESCE(SUM(counter), 0) as total_submissions
                    FROM logger_dailyxformsubmissioncounter
                    WHERE user_id = ANY(%s)
                    GROUP BY user_id
                """, [user_ids])

                all_time_data = {row[0]: row[1] for row in cursor.fetchall()}

                # Current period submissions (we'll calculate for each user's billing period)
                current_period_data = {}

                # Group users by their billing periods to optimize queries
                billing_groups = defaultdict(list)
                org_to_user = {}

                for org_id, dates in billing_dates.items():
                    if dates and 'start' in dates and 'end' in dates:
                        period_key = (dates['start'], dates['end'])
                        billing_groups[period_key].extend(user_ids)  # For simplicity, using all user_ids

                # Query for each billing period group
                for (start_date, end_date), group_user_ids in billing_groups.items():
                    if start_date and end_date:
                        cursor.execute("""
                            SELECT user_id, COALESCE(SUM(counter), 0) as period_submissions
                            FROM logger_dailyxformsubmissioncounter
                            WHERE user_id = ANY(%s)
                            AND date >= %s
                            AND date <= %s
                            GROUP BY user_id
                        """, [group_user_ids, start_date.date(), end_date.date()])

                        for row in cursor.fetchall():
                            current_period_data[row[0]] = row[1]

                # Combine all data
                result = {}
                for user_id in user_ids:
                    result[user_id] = {
                        'all_time': all_time_data.get(user_id, 0),
                        'current_period': current_period_data.get(user_id, 0)
                    }

                return result

        except Exception as e:
            logging.error(f"Error calculating submission usage: {e}")
            return {}


class Command(BaseCommand):
    help = 'Refresh billing periods snapshots with cross-database usage data and materialized view'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes'
        )
        parser.add_argument(
            '--organization-ids',
            nargs='*',
            type=int,
            help='Specific organization IDs to refresh (default: all)'
        )
        parser.add_argument(
            '--skip-mv-refresh',
            action='store_true',
            help='Skip materialized view refresh (useful for testing)'
        )
        parser.add_argument(
            '--cleanup-old',
            action='store_true',
            help='Clean up old inactive snapshots (older than 7 days)'
        )
        parser.add_argument(
            '--skip-usage-calculation',
            action='store_true',
            help='Skip cross-database usage calculation (only update billing periods)'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        organization_ids = options.get('organization_ids')
        skip_mv_refresh = options['skip_mv_refresh']
        cleanup_old = options['cleanup_old']
        skip_usage_calculation = options['skip_usage_calculation']

        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN - No changes will be made')
            )

        try:
            # Cleanup old snapshots if requested
            if cleanup_old:
                self._cleanup_old_snapshots(dry_run)

            # Get organizations to process
            orgs = self._get_organizations(organization_ids)
            self.stdout.write(f'Processing {len(orgs)} organizations...')

            # Get fresh billing dates
            billing_dates = self._get_billing_dates(orgs)

            if not billing_dates:
                self.stdout.write(
                    self.style.WARNING('No billing dates found. Exiting.')
                )
                return

            # Calculate cross-database usage data
            usage_data = {}
            if not skip_usage_calculation:
                self.stdout.write('Calculating cross-database usage data...')
                calculator = CrossDatabaseUsageCalculator()
                usage_data = calculator.calculate_cross_database_usage_batch(orgs, billing_dates)
                self.stdout.write(f'Calculated usage data for {len(usage_data)} organizations')

            # Update snapshots
            billing_stats = self._update_billing_snapshots(billing_dates, dry_run)
            usage_stats = self._update_usage_snapshots(usage_data, dry_run)

            # Print statistics
            self._print_stats(billing_stats, 'BILLING SNAPSHOTS')
            if usage_data:
                self._print_stats(usage_stats, 'USAGE SNAPSHOTS')

            # Refresh materialized view
            if not dry_run and not skip_mv_refresh:
                self._refresh_materialized_view()

            self.stdout.write(
                self.style.SUCCESS('Billing snapshots refresh completed successfully')
            )

        except Exception as e:
            logging.error(f'Error refreshing billing snapshots: {str(e)}')
            raise CommandError(f'Failed to refresh billing snapshots: {str(e)}')

    def _get_organizations(self, organization_ids=None):
        """
        Get organizations to process
        """
        orgs_qs = Organization.objects.select_related('owner__organization_user__user')

        if organization_ids:
            orgs_qs = orgs_qs.filter(id__in=organization_ids)
            self.stdout.write(f'Filtering to specific organizations: {organization_ids}')

        orgs = list(orgs_qs)

        if not orgs:
            raise CommandError('No organizations found to process')

        return orgs

    def _get_billing_dates(self, orgs):
        """
        Get billing dates for organizations
        """
        self.stdout.write('Calculating billing dates...')

        try:
            billing_dates = get_current_billing_period_dates_by_org(orgs)
            self.stdout.write(f'Retrieved billing dates for {len(billing_dates)} organizations')
            return billing_dates
        except Exception as e:
            logging.error(f'Error getting billing dates: {str(e)}')
            raise CommandError(f'Failed to get billing dates: {str(e)}')

    def _update_billing_snapshots(self, billing_dates: Dict[int, Dict], dry_run: bool) -> Dict[str, int]:
        """
        Update billing period snapshots
        """
        stats = {
            'created': 0,
            'deactivated': 0,
            'unchanged': 0,
            'errors': 0
        }

        if dry_run:
            for org_id, dates in billing_dates.items():
                existing = BillingPeriodsSnapshot.get_active_snapshot(org_id)
                if existing:
                    if (
                        existing.current_period_start != dates['start'] or
                        existing.current_period_end != dates['end']
                    ):
                        self.stdout.write(
                            f"Would update billing for Org {org_id}: "
                            f"{dates['start']} to {dates['end']}"
                        )
                        stats['created'] += 1
                    else:
                        stats['unchanged'] += 1
                else:
                    self.stdout.write(
                        f"Would create billing for Org {org_id}: "
                        f"{dates['start']} to {dates['end']}"
                    )
                    stats['created'] += 1
            return stats

        with transaction.atomic():
            # Deactivate all existing billing snapshots
            deactivated_count = BillingPeriodsSnapshot.objects.filter(
                is_active=True
            ).update(is_active=False)
            stats['deactivated'] = deactivated_count

            # Create new billing snapshots
            snapshots_to_create = []
            for org_id, dates in billing_dates.items():
                try:
                    snapshots_to_create.append(BillingPeriodsSnapshot(
                        organization_id=org_id,
                        current_period_start=dates['start'],
                        current_period_end=dates['end'],
                        is_active=True,
                        snapshot_created_at=timezone.now()
                    ))
                except Exception as e:
                    logging.error(f'Error creating billing snapshot for org {org_id}: {str(e)}')
                    stats['errors'] += 1

            # Bulk create new snapshots
            if snapshots_to_create:
                BillingPeriodsSnapshot.objects.bulk_create(snapshots_to_create)
                stats['created'] = len(snapshots_to_create)

        return stats

    def _update_usage_snapshots(self, usage_data: Dict[int, Dict], dry_run: bool) -> Dict[str, int]:
        """
        Update usage snapshots with cross-database data
        """
        stats = {
            'created': 0,
            'deactivated': 0,
            'unchanged': 0,
            'errors': 0
        }

        if not usage_data:
            return stats

        if dry_run:
            for org_id, data in usage_data.items():
                self.stdout.write(
                    f"Would create usage snapshot for Org {org_id}: "
                    f"Storage: {data['storage_bytes_total']} bytes, "
                    f"Submissions: {data['submission_counts_all_time']}"
                )
                stats['created'] += 1
            return stats

        with transaction.atomic():
            # Deactivate all existing usage snapshots
            deactivated_count = OrganizationUsageSnapshot.objects.filter(
                is_active=True
            ).update(is_active=False)
            stats['deactivated'] = deactivated_count

            # Create new usage snapshots
            snapshots_to_create = []
            for org_id, data in usage_data.items():
                try:
                    snapshots_to_create.append(OrganizationUsageSnapshot(
                        organization_id=org_id,
                        effective_user_id=data['effective_user_id'],
                        storage_bytes_total=data['storage_bytes_total'],
                        submission_counts_all_time=data['submission_counts_all_time'],
                        current_period_submissions=data['current_period_submissions'],
                        billing_period_start=data['billing_period_start'],
                        billing_period_end=data['billing_period_end'],
                        is_active=True,
                        snapshot_created_at=timezone.now()
                    ))
                except Exception as e:
                    logging.error(f'Error creating usage snapshot for org {org_id}: {str(e)}')
                    stats['errors'] += 1

            # Bulk create new snapshots
            if snapshots_to_create:
                OrganizationUsageSnapshot.objects.bulk_create(snapshots_to_create)
                stats['created'] = len(snapshots_to_create)

        return stats

    def _cleanup_old_snapshots(self, dry_run: bool):
        """
        Clean up old inactive snapshots
        """
        self.stdout.write('Cleaning up old snapshots...')

        if dry_run:
            billing_count = BillingPeriodsSnapshot.objects.filter(
                is_active=False,
                snapshot_created_at__lt=timezone.now() - timezone.timedelta(days=7)
            ).count()
            usage_count = OrganizationUsageSnapshot.objects.filter(
                is_active=False,
                snapshot_created_at__lt=timezone.now() - timezone.timedelta(days=7)
            ).count()
            self.stdout.write(f'Would delete {billing_count} old billing snapshots')
            self.stdout.write(f'Would delete {usage_count} old usage snapshots')
        else:
            billing_deleted, _ = BillingPeriodsSnapshot.cleanup_old_snapshots()
            usage_deleted, _ = OrganizationUsageSnapshot.cleanup_old_snapshots()
            self.stdout.write(f'Deleted {billing_deleted} old billing snapshots')
            self.stdout.write(f'Deleted {usage_deleted} old usage snapshots')

    def _refresh_materialized_view(self):
        """
        Refresh the materialized view
        """
        self.stdout.write('Refreshing materialized view...')

        try:
            with connection.cursor() as cursor:
                cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv')

            self.stdout.write('Materialized view refreshed successfully')
        except Exception as e:
            logging.error(f'Error refreshing materialized view: {str(e)}')
            self.stdout.write(
                self.style.ERROR(
                    f'Warning: Materialized view refresh failed: {str(e)}'
                )
            )

    def _print_stats(self, stats: Dict[str, int], title: str):
        """
        Print update statistics
        """
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(f'{title} STATISTICS')
        self.stdout.write('=' * 50)

        for key, value in stats.items():
            if key == 'errors' and value > 0:
                color = self.style.ERROR
            elif value > 0:
                color = self.style.SUCCESS
            else:
                color = self.style.WARNING

            self.stdout.write(f'{key.capitalize():12}: {color(str(value))}')

        self.stdout.write('=' * 50 + '\n')
