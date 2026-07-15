from copy import deepcopy

from celery.exceptions import SoftTimeLimitExceeded
from django.db import transaction

from kobo.apps.long_running_migrations.models import (
    LongRunningMigration,
    LongRunningMigrationStatus,
)
from kobo.apps.subsequences.constants import SCHEMA_VERSIONS
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.utils.versioning import (
    _new_revision_from_old,
    _version_list_to_summary_dict,
    build_params,
    migrate_submission_supplementals,
)
from kpi.utils.log import logging

# Pre-migration action IDs the schema converter knows how to consume.
LEGACY_ACTION_IDS = frozenset(
    {'googlets', 'googletx', 'transcript', 'translation', 'qual'}
)


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
        # First bring any leftover pre-migration action IDs (e.g. 'googlets')
        # into the current schema, then rewrite qpath keys to xpath.
        converted_content = _convert_legacy_content(supplement.content)
        new_content = get_sanitized_dict_keys(
            logging_prefix, converted_content, asset
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


def _automatic_transcription_from_googlets(googlets: dict) -> dict | None:
    """
    Rebuild an `automatic_google_transcription` from a bare `googlets` value.

    The canonical converter reconstructs the automatic transcription from the
    `transcript` revision history and only tags the revision that matches the
    `googlets` result. A `googlets` with no accompanying `transcript` — a valid
    "auto-transcribed, never manually transcribed" state — therefore produces
    nothing, so we build the automatic version straight from the `googlets`
    value using the same helpers the converter uses.
    """
    revision = _new_revision_from_old(
        {
            'languageCode': googlets.get('languageCode'),
            'value': googlets.get('value'),
            'dateModified': googlets.get('dateModified'),
        }
    )
    if revision is None:
        return None
    revision['_data']['status'] = 'complete'
    return _version_list_to_summary_dict([revision])


def _convert_legacy_content(content: dict) -> dict:
    """
    Bring any question still holding pre-migration action IDs into the current
    schema via the canonical converter, one question at a time so questions that
    have no legacy data are left untouched. A bare `googlets` (which the
    converter drops for lack of a `transcript` to rebuild from) is filled in
    explicitly.
    """
    has_legacy = any(
        isinstance(actions, dict) and LEGACY_ACTION_IDS & actions.keys()
        for key, actions in content.items()
        if key != '_version'
    )
    if not has_legacy:
        return content

    result = {'_version': SCHEMA_VERSIONS[0]}
    for key, actions in content.items():
        if key == '_version':
            continue
        if not (isinstance(actions, dict) and LEGACY_ACTION_IDS & actions.keys()):
            result[key] = actions
            continue
        # deepcopy: the converter mutates the revision dicts it is handed
        converted = migrate_submission_supplementals({key: deepcopy(actions)}).get(
            key, {}
        )
        if 'googlets' in actions and 'automatic_google_transcription' not in converted:
            automatic = _automatic_transcription_from_googlets(actions['googlets'])
            if automatic is not None:
                converted['automatic_google_transcription'] = automatic
        result[key] = converted
    return result


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

    logging.warning(
        f'{logging_prefix} ' f'- xpath for qpath {qpath} not found. Keeping as qpath.'
    )
    return qpath
