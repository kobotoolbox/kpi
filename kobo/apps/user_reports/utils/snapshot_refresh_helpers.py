from math import inf

from django.db import connection
from django.db.models import Q
from django.db.models.query import QuerySet

from kobo.apps.organizations.models import Organization
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshot,
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus,
)
from ..typing_aliases import OrganizationIterator

CHUNK_SIZE = 1000


def cleanup_stale_snapshots_and_refresh_mv(run_id: str):
    """
    Delete stale snapshot rows and refresh the materialized view
    """
    while True:
        stale_ids = list(
            BillingAndUsageSnapshot.objects.filter(
                ~Q(last_snapshot_run_id=run_id)
            ).values_list('pk', flat=True)[:CHUNK_SIZE]
        )
        if not stale_ids:
            break
        BillingAndUsageSnapshot.objects.filter(pk__in=stale_ids).delete()

    refresh_user_reports_materialized_view()


def get_or_create_run():
    """
    Get or create a `BillingAndUsageSnapshotRun` with status `IN_PROGRESS`
    """
    run, _ = BillingAndUsageSnapshotRun.objects.get_or_create(
        status=BillingAndUsageSnapshotStatus.IN_PROGRESS,
    )
    return run


def iter_org_chunks_after(last_processed_org_id: str) -> QuerySet[Organization]:
    """
    Iterate organizations in key set chunks
    """
    return Organization.objects.filter(pk__gt=last_processed_org_id).order_by('pk')[
        :CHUNK_SIZE
    ]


def process_chunk(
    chunk_qs: OrganizationIterator, usage_map: dict, limits_map: dict, run_id: int
) -> str | None:
    """
    Apply usage data for a chunk of organizations and persist changes

    For each organization in the chunk:
        - If a snapshot already exists, update it with the latest usage data.
        - If no snapshot exists, create a new entry.

    Returns the last processed organization ID
    """

    objs = []
    last_org_id = None

    for org_id in chunk_qs.values_list('id', flat=True):
        last_org_id = org_id
        d = usage_map.get(org_id, {})
        org_limits = limits_map.get(org_id, {})

        objs.append(
            BillingAndUsageSnapshot(
                organization_id=org_id,
                effective_user_id=d.get('effective_user_id'),
                total_storage_bytes=d.get('total_storage_bytes', 0),
                total_submission_count_all_time=d.get(
                    'total_submission_count_all_time', 0
                ),
                total_submission_count_current_period=d.get(
                    'total_submission_count_current_period', 0
                ),
                billing_period_start=d.get('billing_period_start'),
                billing_period_end=d.get('billing_period_end'),
                last_snapshot_run_id=run_id,
                submission_limit=_normalize_limit(org_limits.get('submission_limit')),
                storage_bytes_limit=_normalize_limit(
                    org_limits.get('storage_bytes_limit')
                ),
                asr_seconds_limit=_normalize_limit(org_limits.get('asr_seconds_limit')),
                mt_characters_limit=_normalize_limit(
                    org_limits.get('mt_characters_limit')
                ),
            )
        )

    if objs:
        BillingAndUsageSnapshot.objects.bulk_create(
            objs,
            update_conflicts=True,
            update_fields=[
                'effective_user_id',
                'total_storage_bytes',
                'total_submission_count_all_time',
                'total_submission_count_current_period',
                'billing_period_start',
                'billing_period_end',
                'last_snapshot_run_id',
                'submission_limit',
                'storage_bytes_limit',
                'asr_seconds_limit',
                'mt_characters_limit',
            ],
            unique_fields=['organization_id'],
        )

    return last_org_id


def refresh_user_reports_materialized_view(concurrently=True):
    """
    Refreshes the user reports materialized view (optionally concurrently)
    """
    concurrent_keyword = ' CONCURRENTLY' if concurrently else ''
    sql = f'REFRESH MATERIALIZED VIEW{concurrent_keyword} user_reports_userreportsmv;'

    with connection.cursor() as cursor:
        cursor.execute(sql)


def _normalize_limit(limit: int | float | None) -> int | None:
    """
    Normalize limit values for database storage
    """
    if limit is None:
        return None
    if limit == inf:
        return None
    return int(limit)
