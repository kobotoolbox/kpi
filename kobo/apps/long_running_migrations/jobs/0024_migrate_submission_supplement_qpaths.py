import time
from copy import deepcopy

from kobo.apps.long_running_migrations.models import (
    LongRunningMigration,
    LongRunningMigrationStatus,
)
from kobo.apps.subsequences.models import SubmissionSupplement
from kpi.models import Asset
from kpi.utils.log import logging

SLEEP_BETWEEN_ASSETS = 0.5


def run():
    """
    Migrate all SubmissionSupplement records that are still in an old schema
    format (_version is not the latest)

    Iterates over all assets that have at least one un-migrated supplement and
    delegates to the `migrate_submission_supplements` management command for
    each asset. The management command handles renaming qpaths to xpaths within
    SubmissionSupplements.

    This job is resumable: if it is interrupted (e.g. SoftTimeLimitExceeded),
    the next Beat cycle will pick up the remaining assets with any supplements
    still in the old format
    """

    # make sure migration 0023 is done
    try:
        previous_migration = LongRunningMigration.objects.get(
            name='0023_migrate_submission_supplements'
        )
    except LongRunningMigration.DoesNotExist:
        logging.info('[LRM 0024] - previous migration not present.')
        return
    if previous_migration.status != LongRunningMigrationStatus.COMPLETED:
        logging.info('[LRM 0024] - previous migration not completed.')
        return

    old_uids = set(
        SubmissionSupplement.objects.exclude(content___version='20260506')
        .values_list('asset__uid', flat=True)
        .distinct()
    )
    migrated_supplements_with_qpaths = 0
    migrated_supplements = 0

    total = len(old_uids)
    if total == 0:
        logging.info('[LRM 0024] - Nothing to migrate.')
        return

    logging.info(f'[LRM 0024] - {total} asset(s) with old supplements to migrate')

    for i, uid in enumerate(old_uids, start=1):
        logging.info(f'[LRM 0024] - [{i}/{total}] Migrating asset {uid}')
        asset = Asset.objects.get(uid=uid)
        for supplement in SubmissionSupplement.objects.filter(asset__uid=uid):
            new_content = get_sanitized_dict_keys(supplement.content, asset)
            if new_content:
                supplement.content = get_sanitized_dict_keys(supplement.content, asset)
                supplement.save(
                    update_fields=[
                        'content',
                    ]
                )
                migrated_supplements_with_qpaths += 1
            supplement.content['_version'] = '20260506'
            migrated_supplements += 1
        time.sleep(SLEEP_BETWEEN_ASSETS)

    logging.info(
        f'[LRM 0024] - Done. Migrated {migrated_supplements} submission supplements.'
        f' {migrated_supplements_with_qpaths} supplements with qpaths updated.'
    )


def get_sanitized_dict_keys(content_dict: dict, asset: 'Asset') -> dict | None:
    """
    Update `dict_to_update` keys created with `qpath`(if they are present) with
    their `xpath` counterpart.
    """
    updated_dict = deepcopy(content_dict)
    changed = False
    for old_xpath, values in content_dict.items():
        if old_xpath == '_version':
            continue
        if '-' in old_xpath and '/' not in old_xpath:
            xpath = qpath_to_xpath(old_xpath, asset)
            if xpath == old_xpath:
                continue
            del updated_dict[old_xpath]
            updated_dict[xpath] = values
            changed = True
    if not changed:
        return None

    return updated_dict


def qpath_to_xpath(qpath: str, asset: 'Asset') -> str:
    """
    We have abandoned `qpath` attribute in favor of `xpath`.
    Existing projects may still use it though.
    We need to find the equivalent `xpath`.
    """
    for row in asset.content['survey']:
        if '$qpath' in row and '$xpath' in row and row['$qpath'] == qpath:
            return row['$xpath']

    # If the `qpath` refers to a question that was renamed or deleted, it may
    # no longer match any XPath in the form. In such cases, where it's still
    # present in known_cols, skip this field by returning an empty string
    dashed_qpath = qpath.replace('/', '-')
    for known_col in asset.known_cols:
        if known_col.startswith(dashed_qpath):
            return ''

    # Could not find it from the survey, let's try to detect it automatically
    xpaths = asset.get_attachment_xpaths(deployed=True)
    for xpath in xpaths:
        dashed_xpath = xpath.replace('/', '-')
        if dashed_xpath == qpath:
            return xpath

    raise KeyError(f'xpath for {qpath} not found')
