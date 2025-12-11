import copy
from typing import Any, Iterable

from django.db import transaction

from kobo.apps.subsequences.actions import QualAction
from kobo.apps.subsequences.constants import SCHEMA_VERSIONS, Action
from kobo.apps.subsequences.models import QuestionAdvancedFeature

OLD_QUESTION_TYPE_TO_NEW = {
    'qual_note': 'qualNote',
    'qual_tags': 'qualTags',
    'qual_select_multiple': 'qualSelectMultiple',
    'qual_select_one': 'qualSelectOne',
    'qual_text': 'qualText',
    'qual_integer': 'qualInteger',
}


def migrate_advanced_features(
    asset: 'kpi.models.Asset', save_asset=True
) -> dict | None:
    advanced_features = asset.advanced_features
    if advanced_features is None:
        asset.advanced_features = {'_version': SCHEMA_VERSIONS[0]}
        if save_asset:
            asset.save(update_fields=['advanced_features'], adjust_content=False)
        return
    if asset.advanced_features.get('_version') == SCHEMA_VERSIONS[0]:
        return

    # save a copy so we don't lose data if there's a mistake in the migration
    copied = copy.deepcopy(advanced_features)
    asset_known_cols = asset.known_cols or []
    known_cols = set([col.split(':')[0] for col in asset_known_cols])
    features_to_create = []

    with transaction.atomic():
        for key, value in advanced_features.items():
            if key == 'transcript':
                features_to_create.extend(
                    convert_nlp_params(
                        asset,
                        value,
                        known_cols,
                        Action.MANUAL_TRANSCRIPTION,
                        Action.AUTOMATIC_GOOGLE_TRANSCRIPTION,
                    )
                )
            if key == 'translation':
                features_to_create.extend(
                    convert_nlp_params(
                        asset,
                        value,
                        known_cols,
                        Action.MANUAL_TRANSLATION,
                        Action.AUTOMATIC_GOOGLE_TRANSLATION,
                    )
                )
            if key == 'qual':
                features_to_create.extend(convert_qual_params(asset, value))
        # DANGER: this does not go through validate_params
        QuestionAdvancedFeature.objects.bulk_create(features_to_create)

        # restore the old dict, but mark that we've already migrated
        asset.advanced_features = copied
        asset.advanced_features['_version'] = SCHEMA_VERSIONS[0]
        if save_asset:
            asset.save(update_fields=['advanced_features'], adjust_content=False)


def convert_nlp_params(
    asset,
    action_config: dict,
    known_cols: set[str],
    manual_action: Action,
    automatic_action: Action,
) -> list[QuestionAdvancedFeature]:
    to_create = []
    languages = action_config.get('languages')
    if not languages:
        return to_create
    for q in known_cols:
        to_create.extend(
            [
                QuestionAdvancedFeature(
                    question_xpath=q,
                    asset=asset,
                    action=manual_action,
                    params=[{'language': language} for language in languages],
                ),
                QuestionAdvancedFeature(
                    question_xpath=q,
                    asset=asset,
                    action=automatic_action,
                    params=[{'language': language} for language in languages],
                ),
            ]
        )
    return to_create


def convert_qual_params(
    asset: Any, qualdict: dict[str, Any]
) -> list[QuestionAdvancedFeature]:
    """Convert a qual dict (from `Asset.advanced_features['qual']`) into
    `QuestionAdvancedFeature` objects grouped by `xpath`.
    Returns the list of new `QuestionAdvancedFeature` instances.
    """
    if not qualdict:
        return []

    qual_survey = qualdict.get('qual_survey')
    if not isinstance(qual_survey, Iterable):
        return []

    groups: dict[str, list[dict[str, Any]]] = {}
    for item in qual_survey:
        if not isinstance(item, dict):
            continue
        xpath = item.get('xpath') or item.get('qpath')
        if not xpath:
            continue
        groups.setdefault(xpath, []).append(item)

    created_objs: list[QuestionAdvancedFeature] = []
    for xpath, items in groups.items():
        for item in items:
            item['type'] = OLD_QUESTION_TYPE_TO_NEW[item['type']]
            # remove any top-level cruft
            for key in list(item.keys()):
                if key not in QualAction.KNOWN_PARAM_KEYS:
                    item.pop(key)
        QualAction.validate_params(list(items))
        created_objs.append(
            QuestionAdvancedFeature(
                asset=asset,
                action=Action.QUAL,
                question_xpath=xpath,
                params=list(items),
            )
        )
    return created_objs
