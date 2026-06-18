from datetime import timedelta

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.audit_log.models import AuditLog
from kpi.models import Asset
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
THRESHOLD = timezone.now() - timedelta(days=90)


def run():
    """
    Backfills ExtraUserDetail.last_project_activity from Asset and AuditLog history.

    Skips users with a recent login, they are already considered active by
    get_active_users() via last_login and do not need backfilling.

    For the remaining users:
    1. Most recent asset created_by / last_modified_by within 90 days
    2. Most recent AuditLog entry per user
    3. Sentinel (-731 days) when no activity is found anywhere, so the row is
       non-NULL and idempotent on migration restart.
    """
    last_pk = 0
    while batch := _get_batch(last_pk):
        _process_batch(batch)
        last_pk = batch[-1].pk
        logging.info(
            f'[LRM 0026] backfilled last_project_activity up to '
            f'ExtraUserDetail pk={last_pk}'
        )


def _get_batch(last_pk: int) -> list:
    return list(
        ExtraUserDetail.objects.filter(
            pk__gt=last_pk, last_project_activity__isnull=True
        )
        .exclude(user__last_login__gt=THRESHOLD)
        .select_related('user')
        .only('pk', 'user_id', 'user__id', 'user__username')
        .order_by('pk')[:CHUNK_SIZE]
    )


def _process_batch(batch: list) -> None:
    username_to_ed = {ed.user.username: ed for ed in batch}
    user_id_to_ed = {ed.user_id: ed for ed in batch}

    created_dates = dict(
        Asset.objects.filter(created_by__in=username_to_ed, date_created__gte=THRESHOLD)
        .values('created_by')
        .annotate(max_date=Max('date_created'))
        .values_list('created_by', 'max_date')
    )
    modified_dates = dict(
        Asset.objects.filter(
            last_modified_by__in=username_to_ed, date_modified__gte=THRESHOLD
        )
        .values('last_modified_by')
        .annotate(max_date=Max('date_modified'))
        .values_list('last_modified_by', 'max_date')
    )

    remaining_user_ids = set()
    for username, ed in username_to_ed.items():
        candidates = [
            d
            for d in [created_dates.get(username), modified_dates.get(username)]
            if d is not None
        ]
        if candidates:
            ed.last_project_activity = max(candidates)
        else:
            remaining_user_ids.add(ed.user_id)

    # AuditLog fallback — per-user exists() + LIMIT 1, both use the composite
    # index (user_id, date_created DESC) and are fast individually.
    # GROUP BY MAX() across multiple users is slow even with the index.
    sentinel = timezone.now() - timedelta(days=731)
    if remaining_user_ids:
        for user_id in remaining_user_ids:
            if not AuditLog.objects.filter(user_id=user_id).exists():
                user_id_to_ed[user_id].last_project_activity = sentinel
                continue
            date = (
                AuditLog.objects.filter(user_id=user_id)
                .order_by('-date_created')
                .values_list('date_created', flat=True)
                .first()
            )
            user_id_to_ed[user_id].last_project_activity = date or sentinel

    ExtraUserDetail.objects.bulk_update(batch, ['last_project_activity'])
