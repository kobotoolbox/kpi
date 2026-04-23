import time

from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    DROP_INDEXES_SQL,
    DROP_MV_SQL,
)

REDIS_LOCK_KEY = 'billing_and_usage_snapshot:run_lock'
REDIS_LOCK_TTL = 300
REDIS_LOCK_ACQUIRE_TIMEOUT = 5
PG_LOCK_TIMEOUT = '30s'
POST_TERMINATE_SLEEP = 3


def drop_mv(apps, schema_editor):
    from django.core.cache import cache

    lock = None
    acquired = False
    try:
        lock = cache.lock(REDIS_LOCK_KEY, timeout=REDIS_LOCK_TTL)
    except Exception:
        lock = None

    try:
        if lock is not None:
            try:
                acquired = lock.acquire(
                    blocking=True, blocking_timeout=REDIS_LOCK_ACQUIRE_TIMEOUT
                )
            except Exception:
                acquired = False

        with schema_editor.connection.cursor() as cursor:
            if not acquired:
                terminate_backends_touching_mv(cursor)
                time.sleep(POST_TERMINATE_SLEEP)
                if lock is not None:
                    try:
                        acquired = lock.acquire(
                            blocking=True,
                            blocking_timeout=REDIS_LOCK_ACQUIRE_TIMEOUT,
                        )
                    except Exception:
                        acquired = False

            # Safety net: kill any stray backend still holding a lock on the
            # MV now that we control the Redis lock - just in case.
            terminate_backends_touching_mv(cursor)

            cursor.execute(f"SET lock_timeout = '{PG_LOCK_TIMEOUT}'")
            try:
                cursor.execute(DROP_INDEXES_SQL)
                cursor.execute(DROP_MV_SQL)
            finally:
                cursor.execute('RESET lock_timeout')
    finally:
        if acquired and lock is not None:
            try:
                lock.release()
            except Exception:
                pass


def reschedule_lrm_recreate(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(name='0019_recreate_user_reports_mv').update(
        status='created'
    )


def noop(apps, schema_editor):
    pass


def terminate_backends_touching_mv(cursor):
    """
    Terminate any backend currently refreshing or holding a lock on
    user_reports_userreportsmv. The MV is about to be dropped so losing an
    in-flight refresh is harmless; killing the backend forces the Celery
    snapshot task to release its Redis lock via its `finally` block.
    """
    cursor.execute("""
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE pid <> pg_backend_pid()
          AND (
              query ILIKE '%%REFRESH MATERIALIZED VIEW%%user_reports_userreportsmv%%'
              OR pid IN (
                  SELECT l.pid
                  FROM pg_locks l
                  JOIN pg_class c ON l.relation = c.oid
                  WHERE c.relname = 'user_reports_userreportsmv'
              )
          );
        """)


base_dependencies = [
    ('user_reports', '0007_fix_mfa_is_active_new_table'),
    ('long_running_migrations', '0019_recreate_user_reports_mv'),
]

run_before_migrations = []
if 'djstripe' in settings.INSTALLED_APPS:
    # 0013_2_9 is the first djstripe migration that alters columns the MV
    # depends on (price.type, product.type). Must DROP before this runs.
    run_before_migrations.append(('djstripe', '0013_2_9'))


class Migration(migrations.Migration):
    atomic = False

    dependencies = base_dependencies
    run_before = run_before_migrations

    operations = [
        migrations.RunPython(drop_mv, reverse_code=noop),
        migrations.RunPython(reschedule_lrm_recreate, noop),
    ]
