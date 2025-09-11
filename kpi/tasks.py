import time
from typing import Iterable, List

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
        )
        deleted = queryset.delete()
        # log at debug level so we don't flood the logs
        logging.debug(f'Deleted {deleted[0]} version objects with pk < {min_id}')
        time.sleep(10)


def chunk_queryset(qs, size: int) -> Iterable[List]:
    qs = qs.order_by('id')
    total = qs.count()
    for start in range(0, total, size):
        yield list(qs[start:start + size])


@celery_app.task
def refresh_user_report_snapshots(batch_size: int = 500, bulk_chunk: int = 200):
    org_qs = Organization.objects.select_related('owner__organization_user__user').all()
    calculator = BillingAndUsageCalculator()

    for chunk in chunk_queryset(org_qs, batch_size):
        if not chunk:
            continue

        billing_dates = get_current_billing_period_dates_by_org(chunk)
        usage_map = calculator.calculate_usage_batch(chunk, billing_dates)

        snapshot_objs = []
        org_ids = list(usage_map.keys())
        for org_id, data in usage_map.items():
            snapshot_objs.append(
                BillingAndUsageSnapshot(
                    organization_id=org_id,
                    effective_user_id=data.get('effective_user_id'),
                    storage_bytes_total=data.get('storage_bytes_total'),
                    submission_counts_all_time=data.get('submission_counts_all_time'),
                    current_period_submissions=data.get('current_period_submissions'),
                    billing_period_start=data.get('billing_period_start'),
                    billing_period_end=data.get('billing_period_end'),
                    snapshot_created_at=timezone.now(),
                )
            )

        if snapshot_objs:
            with transaction.atomic():
                BillingAndUsageSnapshot.objects.filter(
                    organization_id__in=org_ids
                ).delete()

                # Bulk create in smaller chunks to avoid overly-large SQL statements
                for start in range(0, len(snapshot_objs), bulk_chunk):
                    part = snapshot_objs[start:start + bulk_chunk]
                    BillingAndUsageSnapshot.objects.bulk_create(part)

    # Refresh materialized view
    with connection.cursor() as cursor:
        cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv')
