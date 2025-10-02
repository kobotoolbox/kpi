import uuid
from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshot,
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus
)
from kobo.apps.user_reports.utils.billing_and_usage_calculator import (
    BillingAndUsageCalculator,
)
from kobo.celery import celery_app

BATCH_SIZE = 1000
BULK_CREATE_BATCH = 1000
BULK_UPDATE_BATCH = 1000
DELETE_BATCH = 1000
RUN_EXPIRY_HOURS = 24


def keyset_chunk_org_ids_after(start_after, chunk_size):
    """
    Yield lists of organization IDs using keyset pagination (id > last).
    If start_after is None, start from beginning.
    """
    qs = Organization.objects.order_by('id').values_list('id', flat=True)
    last = start_after
    while True:
        if last is None:
            part = list(qs[:chunk_size])
        else:
            part = list(qs.filter(id__gt=last)[:chunk_size])
        if not part:
            break
        last = part[-1]
        yield part


def claim_or_create_run():
    """
    Claim an existing running, non-expired snapshot run, or create a new one
    """
    now = timezone.now()
    expires_at = now + timedelta(hours=RUN_EXPIRY_HOURS)

    # Find an existing running, non-expired run and lock it
    with transaction.atomic():
        qs = BillingAndUsageSnapshotRun.objects.select_for_update(
            skip_locked=True
        ).filter(
            status=BillingAndUsageSnapshotStatus.RUNNING
        )

        # Only consider non-expired runs
        qs = qs.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).order_by('-started_at')
        run = qs.first()
        if run:
            return run, False

        # No existing run found, create a new one
        run = BillingAndUsageSnapshotRun.objects.create(
            run_id=uuid.uuid4(),
            status=BillingAndUsageSnapshotStatus.RUNNING,
            started_at=now,
            last_heartbeat_at=now,
            last_processed_org_id=None,
            expires_at=expires_at,
        )
        return run, True


@celery_app.task(soft_time_limit=60 * 60 * 1, time_limit=60 * 60 * 2)
def refresh_user_report_snapshots(batch_size: int = BATCH_SIZE):
    """
    Refresh `BillingAndUsageSnapshot` table in batches

    Workflow:
        1. Generate a run_id (UUID) for this run.
        2. Iterate organizations in keyset chunks.
        3. For each chunk:
           - compute billing dates (bulk)
           - compute usage_map via BillingAndUsageCalculator
           - fetch existing snapshot rows for the chunk in one query
           - prepare `to_update` and `to_create` lists, set last_snapshot_run_id
           - bulk_update and bulk_create in manageable batches inside a transaction
        4. After all chunks processed, delete stale rows
            (rows where last_snapshot_run_id != run_id) in small batches
        5. Refresh materialized view concurrently at the end
    """
    now = timezone.now()
    calc = BillingAndUsageCalculator()

    # Claim or create a run
    run, created = claim_or_create_run()
    run_id = run.run_id
    last_processed_org_id = run.last_processed_org_id
    try:
        for id_chunk in keyset_chunk_org_ids_after(last_processed_org_id, batch_size):
            if not id_chunk:
                continue

            orgs = list(Organization.objects.filter(id__in=id_chunk).order_by('id'))

            # Compute billing and usage in batch
            billing_map = get_current_billing_period_dates_by_org(orgs)
            usage_map = calc.calculate_usage_batch(orgs, billing_map)

            # Fetch existing snapshot rows for this chunk
            existing_qs = BillingAndUsageSnapshot.objects.filter(
                organization_id__in=[str(i) for i in id_chunk]
            )
            existing_map = {s.organization_id: s for s in existing_qs}

            to_update = []
            to_create = []
            for org in orgs:
                oid = str(org.id)
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
                    s.snapshot_created_at = now
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
                        snapshot_created_at=now,
                        last_snapshot_run_id=run_id,
                    )
                    to_create.append(s)

            # Perform bulk updates and creates in a transaction
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
                                'snapshot_created_at',
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

                # Update run progress
                run = BillingAndUsageSnapshotRun.objects.select_for_update().get(
                    pk=run.pk
                )
                run.last_processed_org_id = id_chunk[-1]
                run.last_heartbeat_at = timezone.now()
                run.save(update_fields=['last_processed_org_id', 'last_heartbeat_at'])

        # Mark run as completed
        with transaction.atomic():
            run = BillingAndUsageSnapshotRun.objects.select_for_update().get(pk=run.pk)
            run.status = BillingAndUsageSnapshotStatus.COMPLETED
            run.last_heartbeat_at = timezone.now()
            run.save(update_fields=['status', 'last_heartbeat_at'])

        # Clean up stale snapshot rows (not touched by this run) in batches
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

    except Exception as ex:
        run = BillingAndUsageSnapshotRun.objects.get(pk=run.pk)
        details = run.details or {}
        details.update({'last_error': str(ex), 'ts': timezone.now().isoformat()})
        run.details = details
        run.last_heartbeat_at = timezone.now()
        run.save(update_fields=['details', 'last_heartbeat_at'])
