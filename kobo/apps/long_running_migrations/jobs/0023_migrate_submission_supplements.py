import time

from django.core.management import call_command

from kobo.apps.subsequences.models import SubmissionSupplement
from kpi.utils.log import logging

SLEEP_BETWEEN_ASSETS = 0.5


def run():
    """
    Migrate all SubmissionSupplement records that are still in the old schema
    format (no '_version' key in their content).

    Iterates over all assets that have at least one un-migrated supplement and
    delegates to the `migrate_submission_supplements` management command for
    each asset. The management command handles both the content migration
    (action ID renaming) and the creation of any missing
    QuestionAdvancedFeature records.

    This job is resumable: if it is interrupted (e.g. SoftTimeLimitExceeded),
    the next Beat cycle will pick up the remaining assets because
    already-migrated supplements are excluded by the queryset filter.
    """
    asset_uids = list(
        SubmissionSupplement.objects.exclude(content__has_key='_version')
        .values_list('asset__uid', flat=True)
        .distinct()
    )

    total = len(asset_uids)
    if total == 0:
        logging.info('[LRM 0023] - Nothing to migrate.')
        return

    logging.info(f'[LRM 0023] - {total} asset(s) with old supplements to migrate')

    for i, uid in enumerate(asset_uids, start=1):
        logging.info(f'[LRM 0023] - [{i}/{total}] Migrating asset {uid}')
        call_command('migrate_submission_supplements', asset_uid=uid)
        time.sleep(SLEEP_BETWEEN_ASSETS)

    logging.info('[LRM 0023] - Done')
