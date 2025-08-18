import time
from collections import defaultdict
from typing import Dict, Iterable, Tuple

import requests
from django.apps import apps
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.core.management import call_command
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files
from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.utils import get_billing_dates
from kobo.apps.stripe.utils.subscription_limits import get_organizations_effective_limits
from kobo.celery import celery_app
from kpi.constants import LIMIT_HOURS_23
from kpi.maintenance_tasks import remove_old_asset_snapshots, remove_old_import_tasks
from kpi.models.asset import Asset
from kpi.models.import_export_task import ImportTask, SubmissionExportTask
from kpi.utils.usage_calculator import (
    get_storage_usage_by_user_id,
    get_submission_counts_in_date_range_by_user_id,
    get_nlp_usage_in_date_range_by_user_id, calculate_usage_balance
)


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


@celery_app.task
def precompute_user_usage():
    """
    Precompute all usage/subscription data needed for `/users` API.

    What it computes (matches ServiceUsageCalculator + UserListSerializer behavior):
      - Storage usage (all-time, bytes)
      - Submission counts (all-time and current period)
      - NLP usage (all-time and current period)
      - Usage balances (from effective org limits)
      - Billing period start/end dates
      - Subscriptions (ids, status, start/end)

    What it does:
      1. Maps users to their "effective" user id (MMO orgs use org owner id).
      2. Bulk loads all metrics (storage, submissions, NLP).
      3. Bulk loads org limits for balances.
      4. Bulk loads subscriptions with prefetch.
      5. Stores one cache entry per user (`user_usage:{id}`).
         (Optional future step: bulk upsert into UserUsageSnapshot table for
         DB-level filtering).

    Returns:
        Number of users processed.
    """
    lock_name = 'user_usage_snapshot_lock'
    lock_timeout = settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT
    cache_duration = settings.ENDPOINT_CACHE_DURATION
    with cache.lock(
        lock_name, timeout=lock_timeout, blocking_timeout=0
    ) as lock_acquired:
        if not lock_acquired:
            return 0

    users = list(User.objects.all())
    if not users:
        return 0

    # Map users to effective user ids and billing periods
    effective_by_user, period_by_user = _map_users_to_effective_ids(users)
    effective_ids = sorted(set(effective_by_user.values()))

    if not effective_ids:
        return 0

    # Build per-effective-user date ranges
    date_ranges = {}
    for uid in effective_ids:
        for real_uid, eff_uid in effective_by_user.items():
            if eff_uid == uid:
                start, end = period_by_user[real_uid]
                date_ranges[uid] = {'start': start, 'end': end}
                break

    # 1) Bulk metrics
    storage_by_eff = get_storage_usage_by_user_id(effective_ids)
    subs_period_by_eff = get_submission_counts_in_date_range_by_user_id(date_ranges)
    subs_all_by_eff = _get_alltime_submissions_by_user_id(effective_ids)

    nlp_period_by_eff = get_nlp_usage_in_date_range_by_user_id(date_ranges)
    nlp_all_by_eff = _get_alltime_nlp_by_user_id(effective_ids)

    # 2) Bulk limits (for balances), keyed by org id
    orgs = list({u.organization for u in users if getattr(u, 'organization', None)})
    limits_by_org = get_organizations_effective_limits(orgs, True, True)

    # 3) Bulk subscriptions
    subs_by_user = _get_subscriptions_by_user_id([u.id for u in users])

    # 4) Build DB rows and cache document
    now = timezone.now()
    processed = 0

    for u in users:
        if u.username == 'AnonymousUser':
            # AnonymousUser has no organization, skip it
            continue

        eff_id = effective_by_user[u.id]
        org_limits = limits_by_org[u.organization.id]
        period_start, period_end = period_by_user[u.id]

        total_storage_bytes = int(storage_by_eff.get(eff_id, 0))
        submissions_all = int(subs_all_by_eff.get(eff_id, 0))
        submissions_cur = int(subs_period_by_eff.get(eff_id, 0))

        nlp_all = nlp_all_by_eff.get(eff_id, {})
        nlp_cur = nlp_period_by_eff.get(eff_id, {})
        asr_all = int(nlp_all.get('asr_seconds_all_time', 0))
        mt_all = int(nlp_all.get('mt_characters_all_time', 0))
        asr_cur = int(nlp_cur.get(UsageType.ASR_SECONDS, 0))
        mt_cur = int(nlp_cur.get(UsageType.MT_CHARACTERS, 0))

        balances = {
            'submission': calculate_usage_balance(
                org_limits[f'{UsageType.SUBMISSION}_limit'], submissions_cur
            ),
            'storage_bytes': calculate_usage_balance(
                org_limits[f'{UsageType.STORAGE_BYTES}_limit'], total_storage_bytes
            ),
            'asr_seconds': calculate_usage_balance(
                org_limits[f'{UsageType.ASR_SECONDS}_limit'], asr_cur
            ),
            'mt_characters': calculate_usage_balance(
                org_limits[f'{UsageType.MT_CHARACTERS}_limit'], mt_cur
            ),
        }

        subs_list = subs_by_user.get(u.id, [])

        # ----- DB row (used for DB-level filtering) -------
        # primary_sub_id = subs_list[0]['id'] if subs_list else None
        # snapshots.append(UserUsageSnapshot(
        #     user_id=u.id,
        #     total_storage_bytes=total_storage_bytes,
        #     submissions_all_time=submissions_all,
        #     submissions_current_period=submissions_cur,
        #     asr_seconds_all_time=asr_all,
        #     asr_seconds_current_period=asr_cur,
        #     mt_characters_all_time=mt_all,
        #     mt_characters_current_period=mt_cur,
        #     subscription_id=primary_sub_id,
        #     current_period_start=period_start,
        #     current_period_end=period_end,
        #     balances=balances,
        # ))

        cache_payload = {
            'total_nlp_usage': {
                'asr_seconds_current_period': asr_cur,
                'mt_characters_current_period': mt_cur,
                'asr_seconds_all_time': asr_all,
                'mt_characters_all_time': mt_all,
            },
            'total_storage_bytes': total_storage_bytes,
            'total_submission_count': {
                'all_time': submissions_all,
                'current_period': submissions_cur,
            },
            'balances': balances,
            'current_period_start': period_start,
            'current_period_end': period_end,
            'last_updated': now,
        }

        cache.set(f'user_usage:{u.id}', cache_payload, timeout=cache_duration)
        cache.set(f'user_subs:{u.id}', subs_list, timeout=cache_duration)
        processed += 1

    # 5) Persist
    # with transaction.atomic():
    #     UserUsageSnapshot.objects.all().delete()
    #     UserUsageSnapshot.objects.bulk_create(snapshots, batch_size=500)
    return processed


def _get_alltime_submissions_by_user_id(user_ids: Iterable[int]) -> Dict[int, int]:
    DailyXFormSubmissionCounter = apps.get_model('logger', 'DailyXFormSubmissionCounter')
    rows = (
        DailyXFormSubmissionCounter.objects
        .filter(user_id__in=list(user_ids))
        .values('user_id')
        .annotate(total=Coalesce(Sum('counter'), 0))
    )
    return {r['user_id']: r['total'] for r in rows}


def _get_alltime_nlp_by_user_id(user_ids: Iterable[int]) -> Dict[int, Dict[str, int]]:
    NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')
    rows = (
        NLPUsageCounter.objects
        .filter(user_id__in=list(user_ids))
        .values('user_id')
        .annotate(
            asr_total=Coalesce(Sum(f'total_{UsageType.ASR_SECONDS}'), 0),
            mt_total=Coalesce(Sum(f'total_{UsageType.MT_CHARACTERS}'), 0),
        )
    )
    return {
        r['user_id']: {
            'asr_seconds_all_time': r['asr_total'],
            'mt_characters_all_time': r['mt_total'],
        }
        for r in rows
    }


def _get_subscriptions_by_user_id(user_ids: Iterable[int]) -> Dict[int, list]:
    OrganizationUser = apps.get_model('organizations', 'OrganizationUser')
    result: Dict[int, list] = defaultdict(list)

    org_users = (
        OrganizationUser.objects
        .filter(user_id__in=list(user_ids))
        .select_related('organization')
        .prefetch_related('organization__djstripe_customers__subscriptions')
    )
    for ou in org_users:
        for customer in ou.organization.djstripe_customers.all():
            for sub in customer.subscriptions.all():
                result[ou.user_id].append({
                    'id': str(sub.id),
                    'status': sub.status,
                    'start_date': getattr(sub, 'start_date', None),
                    'end_date': getattr(sub, 'end_date', None),
                })
    return result


def _map_users_to_effective_ids(users):
    org_info = {
        o.id: (o.owner.organization_user.user.id, o.is_mmo)
        for o in Organization.objects.select_related('owner__organization_user__user')
    }

    effective_by_user: Dict[int, int] = {}
    period_by_user: Dict[int, Tuple[timezone.datetime, timezone.datetime]] = {}
    billing_cache: Dict[int, Tuple[timezone.datetime, timezone.datetime]] = {}

    for user in users:
        if user.username == 'AnonymousUser':
            # AnonymousUser has no organization, skip it
            continue

        org = user.organization
        owner_uid, is_mmo = org_info.get(org.id, (None, False))
        effective_id = owner_uid if is_mmo and owner_uid else user.id
        effective_by_user[user.id] = effective_id

        if org.id not in billing_cache:
            start, end = get_billing_dates(org)
            billing_cache[org.id] = (start, end)
        period_by_user[user.id] = billing_cache[org.id]

    return effective_by_user, period_by_user
