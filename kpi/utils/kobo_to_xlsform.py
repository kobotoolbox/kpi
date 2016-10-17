'''
Converts kobo-specific structures into xlsform-standard structures:
This enables us to use the form-builder to open and save structures
which are not standardized xlsform features.

Example structures: scoring, ranking
'''
import re
import json
import random
import string
from kpi.utils.autoname import autoname_fields__depr, autoname_fields
from kpi.utils.autoname import autovalue_choices as autovalue_choices_fn
COLS = {
    'rank-cmessage': 'kobo--rank-constraint-message',
    'rank-items': 'kobo--rank-items',
    'score-choices': 'kobo--score-choices',
}


class RowHandler(object):
    def handle_row(self, row):
        '''
        handle_row(row) should return False to return to the base handler
        '''
        raise NotImplementedError("RowHandler.handle_row"
                                  " must be overridden by subclass")


class BaseHandler(RowHandler):
    _base_handler = False

    def __init__(self, other_sheets={}):
        self.survey_contents = []
        self.other_sheets = other_sheets

    def handle_row(self, row):
        self.survey_contents.append(row)
        return self


class GroupHandler(RowHandler):
    def __init__(self, base_handler):
        self._base_handler = base_handler

    def begin(self, initial_row):
        self._rows = []
        self.initial_row_type = initial_row.get('type')
        self.name_key = 'name' if ('name' in initial_row) else '$autoname'
        self.name = initial_row[self.name_key]

    def finish(self):
        survey_contents = self._base_handler.survey_contents
        for row in self._rows:
            survey_contents.append(row)


class KoboRankGroup(GroupHandler):
    '''
    Convert KoboRankGroup:
    #survey
    |     type    | name |    label     | kobo--rank-items |
    |-------------|------|--------------|------------------|
    | begin_rank  | rnk  | Top 3 needs? | needs            |
    | rank__level | n1   | 1st need     |                  |
    | rank__level | n2   | 2nd need     |                  |
    | rank__level | n3   | 3rd need     |                  |
    | end_rank    |      |              |                  |
    #choices
    | list name |   name  |  label  |
    |-----------|---------|---------|
    | needs     | food    | Food    |
    | needs     | water   | Water   |
    | needs     | shelter | Shelter |

    into:
    #survey
    |       type       |    name   |    label     | appearance | required |             constraint            |
    |------------------|-----------|--------------|------------|----------|-----------------------------------|
    | begin_group      | rnk       |              | field-list |          |                                   |
    | note             | rnk_label | Top 3 needs? |            |          |                                   |
    | select_one needs | n1        | 1st need     | minimal    | true     |                                   |
    | select_one needs | n2        | 2nd need     | minimal    | true     | ${n2} != ${n1}                    |
    | select_one needs | n3        | 3rd need     | minimal    | true     | ${n3} != ${n1} and ${n3} != ${n2} |
    | end group        |           |              |            |          |                                   |
    #choices
    | list name |   name  |  label  |
    |-----------|---------|---------|
    | needs     | food    | Food    |
    | needs     | water   | Water   |
    | needs     | shelter | Shelter |
    '''
    name = 'Kobo rank group'
    description = '''Ask a user to rank a number of things.'''

    def begin(self, initial_row):
        super(KoboRankGroup, self).begin(initial_row)
        self._previous_levels = []

        begin_group = {u'type': u'begin_group',
                       u'name': self.name,
                       u'appearance': u'field-list'}

        if 'required' in initial_row:
            del initial_row['required']
        if 'relevant' in initial_row:
            begin_group['relevant'] = initial_row['relevant']
            del initial_row['relevant']

        try:
            self._rank_itemset = initial_row[COLS['rank-items']]
            del initial_row[COLS['rank-items']]
            self._rank_constraint_message = initial_row[COLS['rank-cmessage']]
            del initial_row[COLS['rank-cmessage']]
        except KeyError:
            raise KeyError("Row with type: %s must have columns: %s and %s" % (
                    self.initial_row_type,
                    COLS['rank-items'],
                    COLS['rank-cmessage'],
                ))
        initial_row.update({'type': 'note',
                            'name': '%s_label' % self.name,
                            'type': 'note',
                            })
        self._rows = [
            begin_group,
            initial_row,
        ]

    def _generate_constraint(self, level_name, previous_levels=[]):
        if len(previous_levels) == 0:
            return ''
        strs = []
        for prev in previous_levels:
            strs.append('${' + level_name + '} != ${' + prev + '}')
        return ' and '.join(strs)

    def add_level(self, row):
        row_name = row['$autoname']
        appearance = row.get('appearance') or 'minimal'
        # all ranking sub-questions are required
        row.update({
            'type': 'select_one',
            'select_from_list_name': self._rank_itemset,
            'required': True,
            'constraint_message': self._rank_constraint_message,
            'appearance': appearance,
            })
        _constraint = self._generate_constraint(row_name,
                                                self._previous_levels)
        if _constraint:
            row['constraint'] = _constraint
        self._previous_levels.append(row_name)
        self._rows.append(row)

    def handle_row(self, row):
        rtype = row.get('type')
        if rtype == 'end_rank':
            self._rows.append({'type': 'end_group'})
            self.finish()
            return False
        elif rtype == 'rank__level':
            self.add_level(row)
        else:
            raise TypeError("'%(type)': KoboRank groups can only contain rows"
                            " with type='rank__level' (or 'end_rank')" % row)


class KoboScoreGroup(GroupHandler):
    name = 'Kobo score group'
    description = '''
    Allows a survey builder to create a likert-scale like structure
    for use across multiple rows.'''

    def __init__(self, base_handler):
        """
        Convert KoboScoreGroup:
        #survey
        |     type    |  name | label | kobo--score-choices | required |
        |-------------|-------|-------|---------------------|----------|
        | begin_score |       | Score | skorechoices        | true     |
        | score__row  |       | Q1    |                     |          |
        | score__row  |       | Q2    |                     |          |
        | end_score   |       |       |                     |          |
        #choices
        |  list name   | name |  label   |
        |--------------|------|----------|
        | skorechoices | c1   | Choice 1 |
        | skorechoices | c2   | Choice 2 |

        into:
        #survey
        |           type          |     name     | label |  appearance  | required |
        |-------------------------|--------------|-------|--------------|----------|
        | begin_group             | Score        |       | field-list   |          |
        | select_one skorechoices | Score_header | Score | label        |          |
        | select_one skorechoices | skr1         | Q1    | list-nolabel | true     |
        | select_one skorechoices | skr2         | Q2    | list-nolabel | true     |
        | end group               |              |       |              |          |
        #choices
        |  list name   | name |  label   |
        |--------------|------|----------|
        | skorechoices | c1   | Choice 1 |
        | skorechoices | c2   | Choice 2 |
        """
        self._base_handler = base_handler

    def begin(self, initial_row):
        super(KoboScoreGroup, self).begin(initial_row)

        begin_group = {u'type': u'begin_group',
                       u'appearance': u'field-list'}
        begin_group[u'name'] = self.name

        if 'required' in initial_row:
            self._initial_row_required = initial_row['required']
            del initial_row['required']

        if 'relevant' in initial_row:
            begin_group['relevant'] = initial_row['relevant']
            del initial_row['relevant']

        try:
            choice_colname = initial_row[COLS['score-choices']]
            self._common = {
                u'type': u'select_one',
                u'select_from_list_name': choice_colname,
            }
            del initial_row[COLS['score-choices']]
        except KeyError:
            raise KeyError("Row with type: %s must have a column: %s" % (
                    self.initial_row_type,
                    COLS['score-choices'],
                ))
        initial_row.update({
            'name': '%s_header' % self.name,
            'appearance': 'label',
        })
        initial_row.update(self._common)
        self._rows = [
            begin_group,
            initial_row,
        ]

    def add_row(self, row):
        appearance = row.get('appearance') or 'list-nolabel'
        row['appearance'] = appearance
        row.update(self._common)
        if hasattr(self, '_initial_row_required') and \
                self._initial_row_required:
            row.update({u'required': True})
        self._rows.append(row)

    def handle_row(self, row):
        if row.get('type') == 'end_score':
            self._rows.append({
                    u'type': u'end_group',
                })
            self.finish()
            return False
        elif row.get('type') == 'score__row':
            self.add_row(row)
            return self
        else:
            raise TypeError("'%s': KoboScore groups"
                            " can only contain rows with type='score__row'"
                            " (or 'end_score')" % row.get('type'))

KOBO_CUSTOM_TYPE_HANDLERS = {
    'begin score': KoboScoreGroup,
    'begin rank': KoboRankGroup,
    'begin_score': KoboScoreGroup,
    'begin_rank': KoboRankGroup,
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
    return (base_handler.survey_contents, features_used)


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
                survey_row['type'] = '{} {}'.format(_srt.keys()[0],
                                                    _srt.values()[0])

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

    for kobo_custom_sheet_name in filter(_is_kobo_specific, surv.keys()):
        del surv[kobo_custom_sheet_name]
    return surv


def expand_rank_and_score_in_place(surv):
    (surv['survey'], features_used) = \
        _parse_contents_of_kobo_structures(surv)
