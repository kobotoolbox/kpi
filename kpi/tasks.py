import time
import uuid
from typing import List

import requests
from django.apps import apps
from django.conf import settings
from django.core import mail
from django.core.exceptions import ObjectDoesNotExist
from django.core.management import call_command
from django.db import connection, connections, transaction
from django.db.models import Min, Q, Sum
from django.utils import timezone
from reversion.models import Version

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.celery import celery_app
from kpi.constants import LIMIT_HOURS_23
from kpi.maintenance_tasks import remove_old_asset_snapshots, remove_old_import_tasks
from kpi.models.asset import Asset
from kpi.models.import_export_task import ImportTask, SubmissionExportTask
from kpi.models.user_reports import BillingAndUsageSnapshot
from kpi.utils.log import logging
from kpi.utils.usage_calculator import BillingAndUsageCalculator


@celery_app.task(
    autoretry_for=(ObjectDoesNotExist,),
    max_retries=settings.MAX_RETRIES_FOR_IMPORT_EXPORT_TASK,
    retry_backoff=True,
)
def import_in_background(import_task_uid):
    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()
    return import_task.uid


@celery_app.task(
    autoretry_for=(ObjectDoesNotExist,),
    max_retries=settings.MAX_RETRIES_FOR_IMPORT_EXPORT_TASK,
    retry_backoff=True,
)
def export_in_background(export_task_uid):
    export_task = SubmissionExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@celery_app.task(
    autoretry_for=(ObjectDoesNotExist,),
    max_retries=settings.MAX_RETRIES_FOR_IMPORT_EXPORT_TASK,
    retry_backoff=True,
)
def export_task_in_background(
    export_task_uid: str, username: str, export_task_name: str
) -> None:
    user = User.objects.get(username=username)
    export_task_class = apps.get_model(export_task_name)

    export_task = export_task_class.objects.get(uid=export_task_uid)
    export = export_task.run()
    if export.status == 'complete' and export.result:
        file_url = f'{settings.KOBOFORM_URL}{export.result.url}'
        msg = (
            f'Hello {user.username},\n\n'
            f'Your report is complete: {file_url}\n\n'
            'Regards,\n'
            'KoboToolbox'
        )
        subject = export.default_email_subject
        mail.send_mail(
            subject=subject,
            message=msg,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )


@celery_app.task
def sync_kobocat_xforms(
    username=None,
    quiet=True,
    populate_xform_kpi_asset_uid=False,
    sync_kobocat_form_media=False,
):
    call_command(
        'sync_kobocat_xforms',
        username=username,
        quiet=quiet,
        populate_xform_kpi_asset_uid=populate_xform_kpi_asset_uid,
        sync_kobocat_form_media=sync_kobocat_form_media,
    )


@celery_app.task
def sync_media_files(asset_uid):
    asset = Asset.objects.defer('content').get(uid=asset_uid)
    if not asset.has_deployment:
        # 🙈 Race condition: Celery task starts too fast and does not see
        # the deployment data, even if asset has been saved prior to call this
        # task
        # TODO Find why the race condition happens and remove `time.sleep(1)`
        time.sleep(1)
        asset.refresh_from_db(fields=['_deployment_data'])

    asset.deployment.sync_media_files()


@celery_app.task
def enketo_flush_cached_preview(server_url, form_id):
    """
    Flush a cached preview from Enketo's Redis database to avoid memory
    exhaustion. Uses the endpoint described in
    https://apidocs.enketo.org/v2#/delete-survey-cache.
    Intended to be run with Celery's `apply_async(countdown=…)` shortly after
    preview generation.
    """
    response = requests.delete(
        f'{settings.ENKETO_URL}/{settings.ENKETO_FLUSH_CACHE_ENDPOINT}',
        # bare tuple implies basic auth
        auth=(settings.ENKETO_API_KEY, ''),
        data=dict(server_url=server_url, form_id=form_id),
    )
    response.raise_for_status()


@celery_app.task(time_limit=LIMIT_HOURS_23, soft_time_limit=LIMIT_HOURS_23)
def perform_maintenance():
    """
    Run daily maintenance tasks.
    """

    remove_unused_markdown_files()
    remove_old_import_tasks()
    remove_old_asset_snapshots()


@celery_app.task(time_limit=30, soft_time_limit=30)
def remove_old_versions():
    while min_id := Version.objects.aggregate(Min('pk'))['pk__min']:
        queryset = Version.objects.filter(
            pk__lt=min_id + settings.VERSION_DELETION_BATCH_SIZE
        ).only('pk')
        deleted = queryset.delete()
        # log at debug level so we don't flood the logs
        logging.debug(f'Deleted {deleted[0]} version objects with pk < {min_id}')
        time.sleep(10)


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

        to_update: List[BillingAndUsageSnapshot] = []
        to_create: List[BillingAndUsageSnapshot] = []
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
                    submission_counts_all_time=data.get('submission_counts_all_time', 0),
                    current_period_submissions=data.get('current_period_submissions', 0),
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
            BillingAndUsageSnapshot.objects
            .filter(~Q(last_snapshot_run_id=run_id))
            .values_list('pk', flat=True)[:DELETE_BATCH]
        )
        if not stale_ids:
            break
        BillingAndUsageSnapshot.objects.filter(pk__in=stale_ids).delete()

    # Refresh materialized view
    with connection.cursor() as cursor:
        cursor.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY user_reports_mv;')
