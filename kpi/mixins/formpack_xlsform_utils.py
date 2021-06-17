# coding: utf-8
# 😬
import copy
from collections import OrderedDict

from formpack.utils.flatten_content import flatten_content
from formpack.utils.spreadsheet_content import flatten_to_spreadsheet_content

from kpi.utils.asset_translation_utils import (
    compare_translations,
    # TRANSLATIONS_EQUAL,
    TRANSLATIONS_OUT_OF_ORDER,
    TRANSLATION_RENAMED,
    TRANSLATION_DELETED,
    TRANSLATION_ADDED,
    TRANSLATION_CHANGE_UNSUPPORTED,
    TRANSLATIONS_MULTIPLE_CHANGES,
)
from kpi.utils.autoname import (
    autoname_fields_in_place,
    autovalue_choices_in_place,
)
from kpi.utils.kobo_to_xlsform import (
    expand_rank_and_score_in_place,
    replace_with_autofields,
    remove_empty_expressions_in_place,
)
from kpi.utils.random_id import random_id
from kpi.utils.standardize_content import (
    needs_standardization,
    standardize_content_in_place,
)

FLATTEN_OPTS = {
    'remove_columns': {
        'survey': [
            '$prev',
            'select_from_list_name',
            '_or_other',
        ],
        'choices': []
    },
    'remove_sheets': [
        'schema',
    ],
}


class FormpackXLSFormUtilsMixin:
    def _standardize(self, content):
        if needs_standardization(content):
            standardize_content_in_place(content)
            return True
        else:
            return False

    def _autoname(self, content):
        autoname_fields_in_place(content, '$autoname')
        autovalue_choices_in_place(content, '$autovalue')

    def _populate_fields_with_autofields(self, content):
        replace_with_autofields(content)

    def _expand_kobo_qs(self, content):
        expand_rank_and_score_in_place(content)

    def _ensure_settings(self, content):
        # asset.settings should exist already, but
        # on some legacy forms it might not
        _settings = OrderedDict(content.get('settings', {}))
        if isinstance(_settings, list):
            if len(_settings) > 0:
                _settings = OrderedDict(_settings[0])
            else:
                _settings = OrderedDict()
        if not isinstance(_settings, dict):
            _settings = OrderedDict()
        content['settings'] = _settings

    def _append(self, content, **sheet_data):
        settings = sheet_data.pop('settings', None)
        if settings:
            self._ensure_settings(content)
            content['settings'].update(settings)
        for (sht, rows) in sheet_data.items():
            if sht in content:
                content[sht] += rows

    def _xlsform_structure(self, content, ordered=True, kobo_specific=False):
        opts = copy.deepcopy(FLATTEN_OPTS)
        if not kobo_specific:
            opts['remove_columns']['survey'].append('$kuid')
            opts['remove_columns']['survey'].append('$autoname')
            opts['remove_columns']['choices'].append('$kuid')
            opts['remove_columns']['choices'].append('$autovalue')
        if ordered:
            if not isinstance(content, OrderedDict):
                raise TypeError('content must be an ordered dict if '
                                'ordered=True')
            flatten_to_spreadsheet_content(content, in_place=True,
                                           **opts)
        else:
            flatten_content(content, in_place=True, **opts)

    def _assign_kuids(self, content):
        for row in content['survey']:
            if '$kuid' not in row:
                row['$kuid'] = random_id(9)
        for row in content.get('choices', []):
            if '$kuid' not in row:
                row['$kuid'] = random_id(9)

    def _strip_kuids(self, content):
        # this is important when stripping out kobo-specific types because the
        # $kuid field in the xform prevents cascading selects from rendering
        for row in content['survey']:
            row.pop('$kuid', None)
        for row in content.get('choices', []):
            row.pop('$kuid', None)

    def _link_list_items(self, content):
        arr = content['survey']
        if len(arr) > 0:
            arr[0]['$prev'] = None
        for i in range(1, len(arr)):
            arr[i]['$prev'] = arr[i - 1]['$kuid']

    def _unlink_list_items(self, content):
        arr = content['survey']
        for row in arr:
            if '$prev' in row:
                del row['$prev']

    def _remove_empty_expressions(self, content):
        remove_empty_expressions_in_place(content)

    def _make_default_translation_first(self, content):
        # The form builder only shows the first language, so make sure the
        # default language is always at the top of the translations list. The
        # new translations UI, on the other hand, shows all languages:
        # https://github.com/kobotoolbox/kpi/issues/1273
        try:
            default_translation_name = content['settings']['default_language']
        except KeyError:
            # No `default_language`; don't do anything
            return
        else:
            self._prioritize_translation(content, default_translation_name)

    def _strip_empty_rows(self, content, vals=None):
        if vals is None:
            vals = {
                'survey': 'type',
                'choices': 'list_name',
            }
        for sheet_name, required_key in vals.items():
            arr = content.get(sheet_name, [])
            arr[:] = [row for row in arr if required_key in row]

    def pop_setting(self, content, *args):
        if 'settings' in content:
            return content['settings'].pop(*args)

    def _rename_null_translation(self, content, new_name):
        if new_name in content['translations']:
            raise ValueError('Cannot save translation with duplicate '
                             'name: {}'.format(new_name))

        try:
            _null_index = content['translations'].index(None)
        except ValueError:
            raise ValueError('Cannot save translation name: {}'.format(
                new_name))
        content['translations'][_null_index] = new_name

    def _has_translations(self, content, min_count=1):
        return len(content.get('translations', [])) >= min_count

    def update_translation_list(self, translation_list):
        existing_ts = self.content.get('translations', [])
        params = compare_translations(existing_ts,
                                      translation_list)
        if None in translation_list and translation_list[0] is not None:
            raise ValueError('Unnamed translation must be first in '
                             'list of translations')
        if TRANSLATIONS_OUT_OF_ORDER in params:
            self._reorder_translations(self.content, translation_list)
        elif TRANSLATION_RENAMED in params:
            _change = params[TRANSLATION_RENAMED]['changes'][0]
            self._rename_translation(self.content, _change['from'],
                                     _change['to'])
        elif TRANSLATION_ADDED in params:
            if None in existing_ts:
                raise ValueError(
                    'cannot add translation if an unnamed translation exists')
            self._prepend_translation(self.content, params[TRANSLATION_ADDED])
        elif TRANSLATION_DELETED in params:
            if params[TRANSLATION_DELETED] != existing_ts[-1]:
                raise ValueError(
                    'you can only delete the last translation of the asset')
            self._remove_last_translation(self.content)
        else:
            for chg in [
                TRANSLATIONS_MULTIPLE_CHANGES,
                TRANSLATION_CHANGE_UNSUPPORTED,
            ]:
                if chg in params:
                    raise ValueError(
                        'Unsupported change: "{}": {}'.format(
                            chg,
                            params[chg]
                        )
                    )

    def _prioritize_translation(self, content, translation_name, is_new=False):
        # the translations/languages present this particular content
        _translations = content['translations']
        # the columns that have translations
        _translated = content.get('translated', [])
        if is_new and (translation_name in _translations):
            raise ValueError('cannot add existing translation')
        elif (not is_new) and (translation_name not in _translations):
            # if there are no translations available, don't try to prioritize,
            # just ignore the translation `translation_name`
            if len(_translations) == 1 and _translations[0] is None:
                return
            else:  # Otherwise raise an error.
                # Remove None from translations we want to display to users
                valid_translations = [t for t in _translations if t is not None]
                raise ValueError(
                    "`{translation_name}` is specified as the default language, "
                    "but only these translations are present in the form: `{translations}`".format(
                        translation_name=translation_name,
                        translations="`, `".join(valid_translations)
                    )
                )

        _tindex = -1 if is_new else _translations.index(translation_name)
        if is_new or (_tindex > 0):
            for sheet_name in 'survey', 'choices':
                for row in content.get(sheet_name, []):
                    for col in _translated:
                        if is_new:
                            val = '{}'.format(row[col][0])
                        else:
                            try:
                                val = row[col].pop(_tindex)
                            except KeyError:
                                continue
                        row[col].insert(0, val)
            if is_new:
                _translations.insert(0, translation_name)
            else:
                _translations.insert(0, _translations.pop(_tindex))

    def _remove_last_translation(self, content):
        content.get('translations').pop()
        _translated = content.get('translated', [])
        for row in content.get('survey', []):
            for col in _translated:
                row[col].pop()
        for row in content.get('choices', []):
            for col in _translated:
                row[col].pop()

    def _prepend_translation(self, content, translation_name):
        self._prioritize_translation(content, translation_name, is_new=True)

    def _reorder_translations(self, content, translations):
        _ts = translations[:]
        _ts.reverse()
        for _tname in _ts:
            self._prioritize_translation(content, _tname)

    def _rename_translation(self, content, _from, _to):
        _ts = content.get('translations')
        if _to in _ts:
            raise ValueError('Duplicate translation: {}'.format(_to))
        _ts[_ts.index(_from)] = _to
