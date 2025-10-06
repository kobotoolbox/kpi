import uuid

from django.db import IntegrityError, transaction, connection
from django.db.models import Q

from kobo.apps.organizations.models import Organization
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshot,
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus,
)

BATCH_SIZE = 1000
BULK_CREATE_BATCH = 1000
BULK_UPDATE_BATCH = 1000
DELETE_BATCH = 1000


def cleanup_stale_snapshots_and_refresh_mv(run_id: str):
    """
    Delete stale snapshot rows and refresh materialized view
    """
    while True:
        stale_ids = list(
            BillingAndUsageSnapshot.objects.filter(
                ~Q(last_snapshot_run_id=run_id)
            ).values_list('pk', flat=True)[:DELETE_BATCH]
        )
        if not stale_ids:
            break
        BillingAndUsageSnapshot.objects.filter(pk__in=stale_ids).delete()

    # Refresh materialized view
    with connection.cursor() as cursor:
        cursor.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY user_reports_mv;')


def get_or_create_run():
    """
    Get or create a `BillingAndUsageSnapshotRun` with status `RUNNING`
    """
    try:
        run, created = BillingAndUsageSnapshotRun.objects.get_or_create(
            status=BillingAndUsageSnapshotStatus.RUNNING,
            defaults={
                'run_id': uuid.uuid4(),
                'last_processed_org_id': None,
            },
        )
        return run
    except IntegrityError:
        run = BillingAndUsageSnapshotRun.objects.filter(
            status=BillingAndUsageSnapshotStatus.RUNNING
        ).order_by('-date_created').first()
        return run


def iter_org_chunks_after(start_after_pk, chunk_size=BATCH_SIZE):
    """
    Iterate organizations in key set chunks
    """
    last = start_after_pk or 0
    while True:
        qs = (
            Organization.objects.only('id')
            .filter(pk__gt=last)
            .order_by('pk')
        )

        chunk_qs = qs[:chunk_size]
        if not chunk_qs.exists():
            break

        last_pk = list(chunk_qs.values_list('pk', flat=True))[-1]
        yield chunk_qs
        last = last_pk


def process_chunk(chunk_qs, usage_map, run_id):
    """
    Apply usage data for a chunk of organizations and persist changes

    For each organization in the chunk:
        - If a snapshot already exists, update it with the latest usage data.
        - If no snapshot exists, create a new entry.

    Returns the last processed organization ID
    """
    existing_qs = BillingAndUsageSnapshot.objects.filter(organization_id__in=chunk_qs)
    existing_map = {s.organization_id: s for s in existing_qs}

    to_update = []
    to_create = []
    last_pk_in_chunk = None
    for org in chunk_qs:
        oid = org.pk
        last_pk_in_chunk = oid
        data = usage_map.get(oid, {})
        if oid in existing_map:
            s = existing_map[oid]
            s.effective_user_id = data.get('effective_user_id')
            s.storage_bytes_total = data.get('storage_bytes_total', 0)
            s.submission_counts_all_time = data.get(
                'submission_counts_all_time', 0
            )
            s.current_period_submissions = data.get(
                'current_period_submissions', 0
            )
            s.billing_period_start = data.get('billing_period_start')
            s.billing_period_end = data.get('billing_period_end')
            s.last_snapshot_run_id = run_id
            to_update.append(s)
        else:
            s = BillingAndUsageSnapshot(
                organization_id=oid,
                effective_user_id=data.get('effective_user_id'),
                storage_bytes_total=data.get('storage_bytes_total', 0),
                submission_counts_all_time=data.get(
                    'submission_counts_all_time', 0
                ),
                current_period_submissions=data.get(
                    'current_period_submissions', 0
                ),
                billing_period_start=data.get('billing_period_start'),
                billing_period_end=data.get('billing_period_end'),
                last_snapshot_run_id=run_id,
            )
            to_create.append(s)

    with transaction.atomic():
        if to_update:
            for i in range(0, len(to_update), BULK_UPDATE_BATCH):
                batch = to_update[i: i + BULK_UPDATE_BATCH]
                BillingAndUsageSnapshot.objects.bulk_update(
                    batch,
                    fields=[
                        'effective_user_id',
                        'storage_bytes_total',
                        'submission_counts_all_time',
                        'current_period_submissions',
                        'billing_period_start',
                        'billing_period_end',
                        'last_snapshot_run_id',
                    ],
                    batch_size=BULK_UPDATE_BATCH,
                )

        if to_create:
            for i in range(0, len(to_create), BULK_CREATE_BATCH):
                batch = to_create[i: i + BULK_CREATE_BATCH]
                BillingAndUsageSnapshot.objects.bulk_create(
                    batch, batch_size=BULK_CREATE_BATCH
                )

    return last_pk_in_chunk
