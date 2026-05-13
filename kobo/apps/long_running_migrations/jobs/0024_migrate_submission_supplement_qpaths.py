from copy import deepcopy

from celery.exceptions import SoftTimeLimitExceeded
from django.db import transaction

from kobo.apps.long_running_migrations.models import (
    LongRunningMigration,
    LongRunningMigrationStatus,
)
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.utils.versioning import build_params
from kpi.utils.log import logging


def run(dry_run: bool = False):
    """
    Migrate all SubmissionSupplement records that contain qpaths as keys
    """
    dry_run_prefix = ' (dry run)' if dry_run else ''
    logging_prefix = f'[LRM 0024]{dry_run_prefix}'
    # make sure migration 0023 is done
    try:
        previous_migration = LongRunningMigration.objects.get(
            name='0023_migrate_submission_supplements'
        )
    except LongRunningMigration.DoesNotExist:
        logging.info(f'{logging_prefix} - previous migration not present.')
        # cheating: force a time limit exceeded error to make celery try again later
        raise SoftTimeLimitExceeded
    if previous_migration.status != LongRunningMigrationStatus.COMPLETED:
        logging.info(f'{logging_prefix} - previous migration not completed.')
        raise SoftTimeLimitExceeded

    supplements_with_qpaths = SubmissionSupplement.objects.extra(
        where=[
            'EXISTS (SELECT 1 from '
            'jsonb_each_text(subsequences_submissionsupplement.content)'
            ' e where e.key ~ %s)'
        ],
        params=[r'.*-.*'],
    ).select_related('asset')

    if not supplements_with_qpaths.exists():
        logging.info(f'{logging_prefix} - No more supplements to migrate.')
        return

    migrated = 0
    total = supplements_with_qpaths.count()
    # keep track of asset/xpath/action qafs we've already seen/created
    existing_qafs: set[tuple[str, str, str]] = set()

    for supplement in supplements_with_qpaths:
        logging.info(f'{logging_prefix} - updating supplement {migrated+1}/{total}')
        asset = supplement.asset
        new_content = get_sanitized_dict_keys(
            logging_prefix, supplement.content, supplement.asset
        )
        with transaction.atomic():
            for xpath, actions_for_xpath in new_content.items():
                if not isinstance(actions_for_xpath, dict):
                    continue
                for action_id in actions_for_xpath.keys():
                    if (asset.uid, xpath, action_id) not in existing_qafs:
                        try:
                            params = build_params(asset, xpath, action_id)
                        except ValueError as ve:
                            logging.warning(
                                f'{logging_prefix} - failed to build params '
                                f'for {xpath}, {action_id}: {ve}'
                            )
                            existing_qafs.add((asset.uid, xpath, action_id))
                            continue

                        if not dry_run:
                            _, created = QuestionAdvancedFeature.objects.get_or_create(
                                asset=asset,
                                question_xpath=xpath,
                                action=action_id,
                                defaults={'params': params},
                            )
                            if created:
                                logging.info(
                                    f'{logging_prefix} - Created QAF asset={asset.uid}'
                                    f' xpath={xpath} action={action_id}'
                                )
                        existing_qafs.add((asset.uid, xpath, action_id))
            if not dry_run:
                supplement.content = new_content
                supplement.save(
                    update_fields=[
                        'content',
                    ]
                )
            migrated += 1

    logging.info(f'{logging_prefix} - Done')


def get_sanitized_dict_keys(
    logging_prefix: str, content_dict: dict, asset: 'kpi.models.Asset'
) -> dict | None:
    """
    Update `dict_to_update` keys created with `qpath`(if they are present) with
    their `xpath` counterpart.
    """
    updated_dict = deepcopy(content_dict)
    for old_xpath, values in content_dict.items():
        if old_xpath == '_version':
            continue
        if '-' in old_xpath and '/' not in old_xpath:
            xpath = qpath_to_xpath(logging_prefix, old_xpath, asset)
            if xpath == old_xpath:
                continue
            del updated_dict[old_xpath]
            updated_dict[xpath] = values
    return updated_dict


def qpath_to_xpath(logging_prefix: str, qpath: str, asset: 'kpi.models.Asset') -> str:
    """
    We have abandoned `qpath` attribute in favor of `xpath`.
    Existing projects may still use it though.
    We need to find the equivalent `xpath`.
    """
    for row in asset.content.get('survey'):
        if '$qpath' in row and '$xpath' in row and row['$qpath'] == qpath:
            return row['$xpath']

    # Could not find it from the survey, let's try to detect it automatically
    xpaths = asset.get_all_attachment_xpaths()
    for xpath in xpaths:
        dashed_xpath = xpath.replace('/', '-')
        if dashed_xpath == qpath:
            return xpath

    logging.warning(f'{logging_prefix} - xpath for qpath {qpath} not found. Keeping as qpath.')
    return qpath
