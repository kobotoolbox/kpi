from __future__ import annotations

from copy import deepcopy
from typing import Optional

import jsonschema

from kpi.fields import WritableJSONField
from ..advanced_features_params_schema import (
    ADVANCED_FEATURES_PARAMS_SCHEMA,
)


def jsonschema_validate(asset: 'Asset'):
    try:
        jsonschema.validate(
            instance=asset.advanced_features,
            schema=ADVANCED_FEATURES_PARAMS_SCHEMA,
        )
    except jsonschema.exceptions.ValidationError as e:
        if "'qpath' was unexpected" not in str(e):
            raise

        qual_survey_orig = asset.advanced_features['qual']['qual_survey']
        qual_survey_iter = deepcopy(qual_survey_orig)
        for idx, qual_q in enumerate(qual_survey_iter):
            qpath = qual_survey_orig[idx]['qpath']
            xpath = qpath_to_xpath(qpath, asset)
            del qual_survey_orig[idx]['qpath']
            qual_survey_orig[idx]['xpath'] = xpath

        jsonschema.validate(
            instance=asset.advanced_features,
            schema=ADVANCED_FEATURES_PARAMS_SCHEMA,
        )


def qpath_to_xpath(qpath: str, asset: 'Asset') -> str:
    """
    We have abandoned `qpath` attribute in favor of `xpath`.
    Existing projects may still use it though.
    We need to find the equivalent `xpath`
    """
    for row in asset.content['survey']:
        if '$qpath' in row and '$xpath' in row and row['$qpath'] == qpath:
            return row['$xpath']

    # Could not find it from the survey, let's try to detect it automatically
    xpaths = asset.get_attachment_xpaths(deployed=True)
    for xpath in xpaths:
        dashed_xpath = xpath.replace('/', '-')
        if dashed_xpath == qpath:
            return xpath

    raise KeyError(f'xpath for {qpath} not found')


def sanitize_known_columns(asset: 'Asset'):
    for idx, known_column in enumerate(asset.known_cols):
        xpath, *rest = known_column.split(':')
        # Old `qpath` should not contain "/", but could contain "-".
        # If the question does not belong to a group but does contain "-",
        # it will enter this condition - which is not a problem except extra
        # CPU usage for nothing.
        if '-' in xpath and '/' not in xpath:
            xpath = qpath_to_xpath(xpath, asset)
            rest.insert(0, xpath)
            asset.known_cols[idx] = ':'.join(rest)

    # TODO Should we save asset.known_cols if it has changed?


def sanitize_submission_extra_content(
    submission_extra: 'SubmissionExtras', asset: 'Asset'
) -> Optional[dict]:
    """
    Replace with `qpath` attribute (if it exists) with `xpath` counterpart
    """
    content = deepcopy(submission_extra.content)
    changed = False
    for old_xpath, values in submission_extra.content.items():
        if '-' in old_xpath and '/' not in old_xpath:
            xpath = qpath_to_xpath(old_xpath, asset)
            if xpath == old_xpath:
                continue

            del content[old_xpath]
            content[xpath] = values
            changed = True

    if changed:
        submission_extra.content = content
        # TODO Should we save submission_extra?


class WritableAdvancedFeaturesField(WritableJSONField):
    """
    This class brings support to old projects which are still using
    `qpath` as the identifier for questions for advanced features.

    It should be deleted and replaced with WritableJSONField when all
    assets are repopulated.
    """
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._model_instance = None

    def to_representation(self, value):
        self._model_instance.validate_advanced_features()
        return value

    def get_attribute(self, instance):
        self._model_instance = instance
        return super().get_attribute(instance)
