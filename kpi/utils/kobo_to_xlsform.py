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

    def begin(self, row):
        self._rows = []

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
    | begin rank  | rnk  | Top 3 needs? | needs            |
    | rank__level | n1   | 1st need     |                  |
    | rank__level | n2   | 2nd need     |                  |
    | rank__level | n3   | 3rd need     |                  |
    | end rank    |      |              |                  |
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
    | begin group      | rnk       |              | field-list |          |                                   |
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
        _name = initial_row.get('name')
        self._previous_levels = []

        begin_group = {'type': 'begin group',
                       'name': _name,
                       'appearance': 'field-list'}

        if 'required' in initial_row:
            del initial_row['required']
        if 'relevant' in initial_row:
            begin_group['relevant'] = initial_row['relevant']
            del initial_row['relevant']

        initial_row_type = initial_row.get('type')

        try:
            self._rank_itemset = initial_row[COLS['rank-items']]
            del initial_row[COLS['rank-items']]
            self._rank_constraint_message = initial_row[COLS['rank-cmessage']]
            del initial_row[COLS['rank-cmessage']]
        except KeyError:
            raise KeyError("Row with type: %s must have columns: %s and %s" % (
                    initial_row_type,
                    COLS['rank-items'],
                    COLS['rank-cmessage'],
                ))
        initial_row.update({'name': '%s_label' % _name,
                            'type': 'note'})
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
        row_name = row['name']
        appearance = row.get('appearance') or 'minimal'
        # all ranking sub-questions are required
        row.update({
            'type': 'select_one %s' % self._rank_itemset,
            'required': 'true',
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
        if rtype == 'end rank':
            self._rows.append({'type': 'end group'})
            self.finish()
            return False
        elif rtype == 'rank__level':
            self.add_level(row)
        else:
            raise TypeError("'%(type)': KoboRank groups can only contain rows"
                            " with type='rank__level' (or 'end rank')" % row)


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
        | begin score | skore | Score | skorechoices        | true     |
        | score__row  | skr1  | Q1    |                     |          |
        | score__row  | skr2  | Q2    |                     |          |
        | end score   |       |       |                     |          |
        #choices
        |  list name   | name |  label   |
        |--------------|------|----------|
        | skorechoices | c1   | Choice 1 |
        | skorechoices | c2   | Choice 2 |

        into:
        #survey
        |           type          |     name     | label |  appearance  | required |
        |-------------------------|--------------|-------|--------------|----------|
        | begin group             | skore        |       | field-list   |          |
        | select_one skorechoices | skore_header | Score | label        |          |
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
        initial_row_type = initial_row.get('type')
        _name = initial_row.get('name')

        begin_group = {'type': 'begin group',
                       'name': _name,
                       'appearance': 'field-list'}

        if 'required' in initial_row:
            self._initial_row_required = initial_row['required']
            del initial_row['required']

        if 'relevant' in initial_row:
            begin_group['relevant'] = initial_row['relevant']
            del initial_row['relevant']

        try:
            choice_colname = initial_row[COLS['score-choices']]
            self._common_type = 'select_one %s' % choice_colname
            del initial_row[COLS['score-choices']]
        except KeyError:
            raise KeyError("Row with type: %s must have a column: %s" % (
                    initial_row_type,
                    COLS['score-choices'],
                ))
        initial_row.update({
            'type': self._common_type,
            'name': '%s_header' % _name,
            'appearance': 'label',
            })

        self._rows = [
            begin_group,
            initial_row,
        ]

    def add_row(self, row):
        appearance = row.get('appearance') or 'list-nolabel'
        row.update({'type': self._common_type,
                    'appearance': appearance,
                    })
        if hasattr(self, '_initial_row_required') and \
                self._initial_row_required:
            row.update({'required': 'true'})
        self._rows.append(row)

    def handle_row(self, row):
        if row.get('type') == 'end score':
            self._rows.append({
                    'type': 'end group',
                })
            self.finish()
            return False
        elif row.get('type') == 'score__row':
            self.add_row(row)
            return self
        else:
            raise TypeError("'%s': KoboScore groups"
                            " can only contain rows with type='score__row'"
                            " (or 'end score')" % row.get('type'))

KOBO_CUSTOM_TYPE_HANDLERS = {
    'begin score': KoboScoreGroup,
    'begin rank': KoboRankGroup,
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


def _is_kobo_specific(name):
    return re.search(r'^kobo--', name)


def remove_empty_expressions(survey_content):
    # xls2json_backends.csv_to_dict(), called by dkobo, omits 'name' keys
    # whose values are blank. Since we read JSON from the form builder
    # instead of CSV, however, we have to tolerate not only missing names
    # but blank ones as well.
    for surv_row in survey_content:
        for skip_key in ['appearance', 'relevant', 'bind']:
            if skip_key in surv_row and surv_row[skip_key] == '':
                del surv_row[skip_key]


def to_xlsform_structure(surv,
                         autoname=True,
                         deprecated_autoname=False,
                         autovalue_choices=True,
                         extract_rank_and_score=True,
                         ):

    if 'survey' in surv:
        for survey_row in surv['survey']:
            if 'type' in survey_row and isinstance(survey_row['type'], dict):
                _srt = survey_row['type']
                survey_row['type'] = '{} {}'.format(_srt.keys()[0],
                                                    _srt.values()[0])
        remove_empty_expressions(surv['survey'])

        if deprecated_autoname:
            surv['survey'] = autoname_fields__depr(surv)
        elif autoname:
            surv['survey'] = autoname_fields(surv)

        if extract_rank_and_score:
            (surv['survey'], features_used) = \
                _parse_contents_of_kobo_structures(surv)

    if 'choices' in surv and autovalue_choices:
        surv['choices'] = autovalue_choices_fn(surv.get('choices', []))

    for kobo_custom_sheet_name in filter(_is_kobo_specific, surv.keys()):
        del surv[kobo_custom_sheet_name]
    return surv
