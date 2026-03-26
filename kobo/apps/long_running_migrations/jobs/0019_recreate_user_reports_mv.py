from django.core.management import call_command
from django.test.utils import override_settings

from kpi.utils.log import logging


def run():
    """
    Rebuilds the user_reports_userreportsmv materialized view in the background
    to avoid locking the db for an extended period of time during the migration.

    SKIP_HEAVY_MIGRATIONS must be forced to False here: this function IS the
    long-running migration handler. If it were True, the management command
    would reset the LongRunningMigration status back to 'created', which would
    re-trigger this job indefinitely (infinite loop).

    Indexes are created with CONCURRENTLY to avoid locking the materialized
    view during index creation.
    """
    logging.info('Starting background recreation of user_reports_userreportsmv...')
    with override_settings(SKIP_HEAVY_MIGRATIONS=False):
        call_command('manage_user_reports_mv', create=True, concurrent=True)
    logging.info('Successfully recreated user_reports_userreportsmv.')
