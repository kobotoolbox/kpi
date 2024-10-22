from __future__ import annotations

import json
from copy import deepcopy

from kpi.fields import WritableJSONField


def get_sanitized_advanced_features(asset: 'Asset') -> dict | None:
    """
    Replace `qpath` attributes (if present) with their `xpath`
    counterparts in asset.advanced_features
    """

    if not asset.advanced_features:
        return

    if 'qpath' not in json.dumps(asset.advanced_features):
        return

    advanced_features = deepcopy(asset.advanced_features)
    qual_survey_orig = advanced_features['qual']['qual_survey']
    qual_survey_iter = deepcopy(qual_survey_orig)
    for idx, qual_q in enumerate(qual_survey_iter):
        qpath = qual_survey_orig[idx]['qpath']
        xpath = qpath_to_xpath(qpath, asset)
        del qual_survey_orig[idx]['qpath']
        qual_survey_orig[idx]['xpath'] = xpath

    return advanced_features


def get_sanitized_dict_keys(dict_to_update: dict, asset: 'Asset') -> dict | None:
    """
    Update `dict_to_update` keys created with `qpath`(if they are present) with
    their `xpath` counterpart.
    """
    updated_dict = deepcopy(dict_to_update)
    changed = False
    for old_xpath, values in dict_to_update.items():
        if '-' in old_xpath and '/' not in old_xpath:
            xpath = qpath_to_xpath(old_xpath, asset)
            if xpath == old_xpath:
                continue

            del updated_dict[old_xpath]
            updated_dict[xpath] = values
            changed = True

    if changed:
        return updated_dict


def get_sanitized_known_columns(asset: 'Asset') -> list:

    known_cols = list(asset.known_cols)

    for idx, known_column in enumerate(known_cols):
        xpath, *rest = known_column.split(':')
        # Old `qpath` should not contain "/", but could contain "-".
        # If the question does not belong to a group but does contain "-",
        # it will enter this condition - which is not a problem except extra
        # CPU usage for nothing.
        if '-' in xpath and '/' not in xpath:
            xpath = qpath_to_xpath(xpath, asset)
            rest.insert(0, xpath)
            known_cols[idx] = ':'.join(rest)

    return known_cols


def qpath_to_xpath(qpath: str, asset: 'Asset') -> str:
    """
    We have abandoned `qpath` attribute in favor of `xpath`.
    Existing projects may still use it though.
    We need to find the equivalent `xpath`.
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
        return self._model_instance.advanced_features

    def get_attribute(self, instance):
        self._model_instance = instance
        return super().get_attribute(instance)
