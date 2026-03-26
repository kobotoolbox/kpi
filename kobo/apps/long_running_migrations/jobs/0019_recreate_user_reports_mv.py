from django.core.management import call_command

from kpi.utils.log import logging


def run():
    """
    Rebuilds the user_reports_userreportsmv materialized view in the background
    to avoid locking the db for an extended period of time during the migration.

    --force bypasses SKIP_HEAVY_MIGRATIONS and creates indexes with
    CONCURRENTLY. This is required here: without it, the command would
    reschedule the long-running migration instead of executing it, causing
    this job to loop indefinitely.
    """
    logging.info('Starting background recreation of user_reports_userreportsmv...')
    call_command('manage_user_reports_mv', create=True, force=True)
    logging.info('Successfully recreated user_reports_userreportsmv.')
