from datetime import datetime, timedelta
from time import sleep

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.models import Asset
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE


def run():
    """
    Backfills ExtraUserDetail.last_project_activity from login history, Asset,
    XForm, and Instance records.

    For each user with last_project_activity IS NULL:
    1. last_login within 90 days → use last_login directly (active under ALL admin
       filter presets: 90 / 180 / 365 / 730 days). No further queries.
    2. Asset batch query: MAX(date_created / date_modified) within 365 days.
    3. XForm batch query: MAX(last_submission_time) within 365 days (form owner).
       Runs for ALL remaining users — a user with an older asset date may have a
       more recent received submission. Pre-computed field avoids GROUP BY MAX on
       a multi-billion-row Instance table.
    4. Per-user Instance query: most recent submission as submitter within 365 days.
       Only for users with no date from any earlier source.
    5. login_fallback: for users with last_login in the 91-364 day range but no
       project activity found in steps 2-4, fall back to last_login.
    6. Sentinel (-731 days) when no activity is found anywhere, so the row is
       non-NULL and idempotent on migration restart.
    """
    last_pk = 0
    threshold = timezone.now() - timedelta(days=365)

    while batch := _get_batch(last_pk):
        _process_batch(batch, threshold)
        last_pk = batch[-1].pk
        logging.info(
            f'[LRM 0026] backfilled last_project_activity up to '
            f'ExtraUserDetail pk={last_pk}'
        )
        sleep(0.5)


def _get_batch(last_pk: int) -> list:
    return list(
        ExtraUserDetail.objects.filter(
            pk__gt=last_pk, last_project_activity__isnull=True
        )
        .select_related('user')
        .only('pk', 'user_id', 'user__id', 'user__username', 'user__last_login')
        .order_by('pk')[:CHUNK_SIZE]
    )


def _process_batch(batch: list, threshold: datetime) -> None:
    # Step 1: 90-day login shortcut (in-memory, no DB query).
    # Users who logged in within 90 days are active under ALL admin filter presets
    # (90 / 180 / 365 / 730 days). Safe to use last_login directly and skip DB queries.
    recent_login_threshold = timezone.now() - timedelta(days=90)
    remaining = []
    for ed in batch:
        if ed.user.last_login and ed.user.last_login >= recent_login_threshold:
            ed.last_project_activity = ed.user.last_login
        else:
            remaining.append(ed)

    if not remaining:
        ExtraUserDetail.objects.bulk_update(batch, ['last_project_activity'])
        return

    username_to_ed = {ed.user.username: ed for ed in remaining}
    user_id_to_ed = {ed.user_id: ed for ed in remaining}

    # Collect last_login as a fallback for users with login in the 91-364 day range.
    # Steps 2-4 may find more recent project activity (e.g., received submissions);
    # last_login is only applied if nothing else is found within the 365-day window.
    login_fallback = {
        ed.user_id: ed.user.last_login
        for ed in remaining
        if ed.user.last_login and ed.user.last_login >= threshold
    }

    # Step 2: Asset batch queries (KPI DB).
    # Query 1: assets owned by the user that were recently modified by anyone.
    # Using date_modified (not date_created) covers both newly created assets and
    # existing assets touched by a collaborator.
    # Query 2: assets the user recently modified themselves (regardless of ownership).
    owned_dates = dict(
        Asset.objects.filter(
            created_by__in=username_to_ed, date_modified__gte=threshold
        )
        .values('created_by')
        .annotate(max_date=Max('date_modified'))
        .values_list('created_by', 'max_date')
    )
    modifier_dates = dict(
        Asset.objects.filter(
            last_modified_by__in=username_to_ed, date_modified__gte=threshold
        )
        .values('last_modified_by')
        .annotate(max_date=Max('date_modified'))
        .values_list('last_modified_by', 'max_date')
    )
    for username, ed in username_to_ed.items():
        candidates = [
            d
            for d in [owned_dates.get(username), modifier_dates.get(username)]
            if d is not None
        ]
        if candidates:
            ed.last_project_activity = max(candidates)

    # Step 3: XForm batch query — form owner (KoboCAT DB).
    # Runs for ALL remaining users (not just those without an asset date): a user
    # may have an older asset date but a more recent received submission.
    # XForm.last_submission_time is pre-computed; avoids GROUP BY MAX on Instance.
    xform_dates = dict(
        XForm.objects.filter(
            user_id__in=user_id_to_ed, last_submission_time__gte=threshold
        )
        .values('user_id')
        .annotate(max_date=Max('last_submission_time'))
        .values_list('user_id', 'max_date')
    )
    for user_id, date in xform_dates.items():
        ed = user_id_to_ed[user_id]
        if ed.last_project_activity is None or date > ed.last_project_activity:
            ed.last_project_activity = date

    # Step 4: Per-user Instance query — as submitter (KoboCAT DB).
    # Only for users with no date from any earlier source. The composite index
    # on (user_id, date_modified DESC) makes LIMIT 1 efficient here.
    for ed in (ed for ed in remaining if ed.last_project_activity is None):
        date = (
            Instance.objects.filter(user_id=ed.user_id, date_modified__gte=threshold)
            .values_list('date_modified', flat=True)
            .order_by('-date_modified')
            .first()
        )
        if date is not None:
            ed.last_project_activity = date

    # Apply login fallback or sentinel to users still without a date.
    sentinel = timezone.now() - timedelta(days=731)
    for ed in remaining:
        if ed.last_project_activity is None:
            ed.last_project_activity = login_fallback.get(ed.user_id, sentinel)

    ExtraUserDetail.objects.bulk_update(batch, ['last_project_activity'])
