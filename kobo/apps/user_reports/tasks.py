import uuid

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.user_reports.models import BillingAndUsageSnapshot
from kobo.apps.user_reports.utils.billing_and_usage_calculator import (
    BillingAndUsageCalculator,
)
from kobo.celery import celery_app


def keyset_chunk_org_ids(chunk_size):
    """
    Yield lists of organization IDs using keyset pagination (id > last),
    this avoids OFFSET scans which are slow at large offsets.
    """
    qs = Organization.objects.order_by('id').values_list('id', flat=True)
    last = None
    while True:
        if last is None:
            part = list(qs[:chunk_size])
        else:
            part = list(qs.filter(id__gt=last)[:chunk_size])
        if not part:
            break
        last = part[-1]
        yield part


@celery_app.task
def refresh_user_report_snapshots(batch_size: int = 500):
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
    BULK_CREATE_BATCH = 200
    BULK_UPDATE_BATCH = 200
    DELETE_BATCH = 1000

    now = timezone.now()
    run_id = uuid.uuid4()
    calc = BillingAndUsageCalculator()
    for id_chunk in keyset_chunk_org_ids(chunk_size=batch_size):
        if not id_chunk:
            continue

        orgs = list(Organization.objects.filter(id__in=id_chunk))

        # billing periods map and usage map
        billing_map = get_current_billing_period_dates_by_org(orgs)
        usage_map = calc.calculate_usage_batch(orgs, billing_map)

        # fetch existing snapshot rows for this chunk
        str_ids = [str(i) for i in id_chunk]
        existing_qs = BillingAndUsageSnapshot.objects.filter(
            organization_id__in=str_ids
        )
        existing_map = {s.organization_id: s for s in existing_qs}

        to_update: list[BillingAndUsageSnapshot] = []
        to_create: list[BillingAndUsageSnapshot] = []
        for org in orgs:
            oid = str(org.id)
            data = usage_map.get(oid, {})

            if oid in existing_map:
                s = existing_map[oid]
                s.effective_user_id = data.get('effective_user_id')
                s.storage_bytes_total = data.get('storage_bytes_total', 0)
                s.submission_counts_all_time = data.get('submission_counts_all_time', 0)
                s.current_period_submissions = data.get('current_period_submissions', 0)
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

        # update/create in a transaction per chunk
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

    # Delete stale rows (rows not touched by this run) in small batches
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
