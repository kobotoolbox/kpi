# coding: utf-8
'''
Converts kobo-specific structures into xlsform-standard structures:
This enables us to use the form-builder to open and save structures
which are not standardized xlsform features.

Example structures: scoring, ranking
'''
import copy
import re

from kpi.utils.autoname import autoname_fields__depr

from .xlsform_preprocessors.base_handlers import BaseHandler
from .xlsform_preprocessors.kobomatrix_handler import KoboMatrixGroupHandler
from .xlsform_preprocessors.koboscore_handler import KoboScoreGroup
from .xlsform_preprocessors.koborank_handler import KoboRankGroup

KOBO_CUSTOM_TYPE_HANDLERS = {
    'begin score': KoboScoreGroup,
    'begin rank': KoboRankGroup,
    'begin_score': KoboScoreGroup,
    'begin_rank': KoboRankGroup,
    'begin_kobomatrix': KoboMatrixGroupHandler,
}


def _parse_contents_of_kobo_structures(ss_structure):
    contents = ss_structure['survey']
    features_used = set()
    base_handler = BaseHandler(ss_structure)
    current_handler = base_handler
    for row in contents:
        rtype = row.get('type')
        if rtype in KOBO_CUSTOM_TYPE_HANDLERS:
            custom_handler = KOBO_CUSTOM_TYPE_HANDLERS[rtype]
            next_handler = custom_handler(base_handler=current_handler)
            features_used.add(custom_handler.name)
            current_handler = next_handler
            next_handler.begin(row)
        else:
            result = current_handler.handle_row(row)
            if result is False:
                current_handler = base_handler
    return base_handler.survey_contents, features_used


def _is_kobo_specific(sheet_name):
    return re.search(r'^kobo--', sheet_name)


def remove_empty_expressions_in_place(content):
    # xls2json_backends.csv_to_dict(), called by dkobo, omits 'name' keys
    # whose values are blank. Since we read JSON from the form builder
    # instead of CSV, however, we have to tolerate not only missing names
    # but blank ones as well.
    for surv_row in content.get('survey'):
        for skip_key in ['appearance', 'relevant', 'bind']:
            if skip_key in surv_row and surv_row[skip_key] in ['', None]:
                del surv_row[skip_key]


def replace_with_autofields(content):
    for row in content.get('survey', []):
        _auto = row.pop('$autoname', None)
        if _auto:
            row['name'] = _auto
    for row in content.get('choices', []):
        _auto = row.pop('$autovalue', None)
        if _auto:
            row['name'] = _auto


def to_xlsform_structure(surv,
                         deprecated_autoname=False,
                         extract_rank_and_score=True,
                         move_autonames=False,
                         ):

    if 'survey' in surv:
        for survey_row in surv['survey']:
            if 'type' in survey_row and isinstance(survey_row['type'], dict):
                # this issue is taken care of in 'standardize_content(...)'
                # but keeping it around just in case.
                _srt = survey_row['type']
                survey_row['type'] = '{} {}'.format(list(_srt.keys())[0],
                                                    list(_srt.values())[0])

        # this is also done in asset.save()
        remove_empty_expressions_in_place(surv)

        if deprecated_autoname:
            surv['survey'] = autoname_fields__depr(surv)

        if extract_rank_and_score:
            expand_rank_and_score_in_place(surv)
            (surv['survey'], features_used) = \
                _parse_contents_of_kobo_structures(surv)

    if move_autonames:
        replace_with_autofields(surv)

    surv_= copy.deepcopy(surv)
    for kobo_custom_sheet_name in filter(_is_kobo_specific, surv.keys()):
        del surv_[kobo_custom_sheet_name]
    return surv_


def expand_rank_and_score_in_place(surv):
    (surv['survey'], features_used) = \
        _parse_contents_of_kobo_structures(surv)
