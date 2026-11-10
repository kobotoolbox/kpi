import csv
import datetime
import logging
import zipfile
from collections import defaultdict
from datetime import timedelta
from io import StringIO

from celery import shared_task
from constance import config
from dateutil import relativedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from redis.exceptions import LockError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.utils.log import logging
from ..main.models import UserProfile
from .constants import RECOUNT_STORAGE_ROTATION_LOCK_KEY
from .models import Instance, XForm
from .models.daily_xform_submission_counter import DailyXFormSubmissionCounter
from .models.instance import InstanceHistory
from .utils.counters import recount_next_drifted_storage_counters


@celery_app.task()
def delete_daily_counters():
    today = timezone.now().date()
    delta = timedelta(days=settings.DAILY_COUNTERS_MAX_DAYS)
    rel_date = today - delta
    xform_daily_counters = DailyXFormSubmissionCounter.objects.filter(
        date__lte=rel_date
    )
    xform_daily_counters.delete()


@shared_task(
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT
)
def generate_stats_zip(output_filename):
    # Limit to last month and this month
    now = datetime.datetime.now()
    start_of_last_month = datetime.datetime(
        year=now.year, month=now.month, day=1
    ) - relativedelta.relativedelta(months=1)

    REPORTS = {
        'instances (since {:%Y-%m-%d}).csv'.format(start_of_last_month): {
            'model': Instance,
            'date_field': 'date_created'
        },
        'xforms (since {:%Y-%m-%d}).csv'.format(start_of_last_month): {
            'model': XForm,
            'date_field': 'date_created'
        },
        'users (since {:%Y-%m-%d}).csv'.format(start_of_last_month): {
            'model': User,
            'date_field': 'date_joined'
        }
    }

    def list_created_by_month(model, date_field):
        queryset = model.objects.filter(
            **{date_field + '__gte': start_of_last_month}
        )
        # Make a single, huge query to the database
        data_dump = list(queryset.values_list('pk', date_field))
        # Sort by date
        data_dump = sorted(data_dump, key=lambda x: x[1])

        year_month_counts = defaultdict(lambda: defaultdict(lambda: 0))
        last_pks = defaultdict(lambda: defaultdict(lambda: 0))
        for pk, date in data_dump:
            year_month_counts[date.year][date.month] += 1
            last_pks[date.year][date.month] = pk

        results = []
        cumulative = 0
        for year in sorted(year_month_counts.keys()):
            for month in sorted(year_month_counts[year].keys()):
                cumulative += year_month_counts[year][month]
                results.append((
                    year, month, year_month_counts[year][month],
                    cumulative, last_pks[year][month]
                ))

        return results

    with default_storage.open(output_filename, 'wb') as output_file:
        zip_file = zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED)
        for filename, report_settings in REPORTS.items():
            model_name_plural = report_settings['model']._meta.verbose_name_plural
            fieldnames = [
                'Year',
                'Month',
                f'New {model_name_plural.capitalize()}',
                f'Cumulative {model_name_plural.capitalize()}',
                'Last Primary Key (possible clue about deleted objects)',
            ]
            data = list_created_by_month(
                report_settings['model'], report_settings['date_field'])
            csv_io = StringIO()
            writer = csv.DictWriter(csv_io, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                writer.writerow(dict(zip(fieldnames, row)))
            zip_file.writestr(filename, csv_io.getvalue())
            csv_io.close()

        zip_file.close()


# TODO Remove this task (and its Celery Beat entry) once every storage drift
#  is fixed
@celery_app.task
def fix_stale_submissions_suspended_flag():
    """
    Release the accounts left suspended by a process which died before
    releasing them (`populate_submission_counters`, or the previous
    `update_attachment_storage_bytes` still running during a deployment), so
    that nobody stays locked out of collecting data.
    """

    # FIXME Every suspended profile is released, including the ones
    #  `populate_submission_counters` is still processing, so its suspension can
    #  be lifted while it recalculates the user's counters
    suspended = UserProfile.objects.filter(submissions_suspended=True)
    usernames = list(suspended.values_list('user__username', flat=True))
    suspended.update(submissions_suspended=False)
    for username in usernames:
        logging.info(
            f'Removed `submissions_suspended` flag on user {username}’s profile'
        )


@celery_app.task
def delete_expired_instance_history_records(chunk_size=10000, max_records=1000000):
    threshold_time = timezone.now() - timedelta(
        days=config.SUBMISSION_HISTORY_RETENTION
    )
    history_ids = InstanceHistory.objects.filter(
        date_created__lte=threshold_time,
        xform_instance=None,
    ).values_list('id', flat=True)[:max_records]
    n_objs = len(history_ids)
    logging.info(f'Found {n_objs} expired InstanceHistory objects. Cleaning up ...')
    for page_start in range(0, n_objs, chunk_size):
        batch_ids = history_ids[page_start:page_start + chunk_size]
        logging.warning(
            f'Deleting batch of {len(batch_ids)} InstanceHistory objects...'
        )
        queryset = InstanceHistory.objects.filter(pk__in=batch_ids)
        # We use _raw_delete to avoid going through the ORM delete process.
        # This model is very simple and can be deleted directly without issues
        queryset._raw_delete(queryset.db)


@celery_app.task(
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def recount_drifted_storage_counters():
    """
    Recount the storage counters of the projects which may have drifted (see
    `get_xform_ids_to_recount()`), in turns: each run recounts until its soft
    time limit, and the next one resumes after the last project recounted.
    Once the end is reached, the walk starts over, so every such project is
    checked again and again.
    Storage is billed: a counter must not stay wrong.

    Each drift fixed is logged as `storage_counter_drift`. Once counters stop
    drifting, it should not show up anymore.

    Safe to kill at any time: one run at a time holds the lock, which expires
    on its own, the cursor is saved after each project, and recounting a
    project twice changes nothing the second time.
    """

    lock = cache.lock(
        RECOUNT_STORAGE_ROTATION_LOCK_KEY,
        timeout=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5,
    )
    if not lock.acquire(blocking=False):
        logging.info('[Storage recount] - Nothing to do, already running')
        return

    try:
        recount_next_drifted_storage_counters()
    finally:
        # The lock outlives the task's time limit, so it is still ours here,
        # unless Redis lost the key (restart, eviction). `release()` raises
        # then, and must not hide the task's own result or error
        try:
            lock.release()
        except LockError as e:
            logging.warning(f'[Storage recount] - Lock was not released: {e}')
