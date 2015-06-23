'''
Converts kobo-specific structures into xlsform-standard structures:
This enables us to use the form-builder to open and save structures which are not
standardized xlsform features. 

Example structures: scoring, ranking
'''
import re
import json
import random
import string

class RowHandler(object):
    def handle_row(self, row):
        '''
        handle_row(row) should return False to return to the base handler
        '''
        raise NotImplementedError("RowHandler.handle_row must be overridden by subclass")

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
        self._base_handler=base_handler

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
    |       type       |    name   |    label     | appearance | reqd |         constraint_message        |
    |------------------|-----------|--------------|------------|------|-----------------------------------|
    | begin group      | rnk       |              | field-list |      |                                   |
    | note             | rnk_label | Top 3 needs? |            |      |                                   |
    | select_one needs | n1        | 1st need     | minimal    | true |                                   |
    | select_one needs | n2        | 2nd need     | minimal    | true | ${n2} != ${n1}                    |
    | select_one needs | n3        | 3rd need     | minimal    | true | ${n3} != ${n1} and ${n3} != ${n2} |
    | end group        |           |              |            |      |                                   |
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
        self._name = initial_row.get('name')
        self._previous_levels = []
        initial_row_type = initial_row.get('type')
        try:
            self._rank_itemset = initial_row['kobo--rank-items']
            del initial_row['kobo--rank-items']
            self._rank_constraint_message = initial_row['kobo--rank-constraint-message']
            del initial_row['kobo--rank-constraint-message']
        except KeyError, e:
            raise KeyError("Row with type: %s must have columns: %s and %s" % (
                    initial_row_type,
                    'kobo--rank-items',
                    'kobo--rank-constraint-message',
                ))
        initial_row['name'] = '%s_label' % self._name
        initial_row['type'] = 'note'
        self._rows = [
            {
                'type': 'begin group',
                'name': self._name,
                'appearance': 'field-list',
            },
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
        row.update({
            'type': 'select_one %s' % self._rank_itemset,
            'required': 'true',
            'constraint_message': self._rank_constraint_message,
            'appearance': appearance,
            })
        _constraint = self._generate_constraint(row_name, self._previous_levels)
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
            raise TypeError("'%s': KoboRank groups can only contain rows with type='rank__level' (or 'end rank')" % row.get('type'))



class KoboScoreGroup(GroupHandler):
    name = 'Kobo score group'
    description = '''
    Allows a survey builder to create a likert-scale like structure
    for use across multiple rows.'''
    def __init__(self, base_handler):
        """
        Convert KoboScoreGroup:
        #survey
        |     type    |  name | label | kobo--score-choices |
        |-------------|-------|-------|---------------------|
        | begin score | skore | Score | skorechoices        |
        | score__row  | skr1  | Q1    |                     |
        | score__row  | skr2  | Q2    |                     |
        | end score   |       |       |                     |
        #choices
        |  list name   | name |  label   |
        |--------------|------|----------|
        | skorechoices | c1   | Choice 1 |
        | skorechoices | c2   | Choice 2 |

        into:
        #survey 
        |           type          |     name     | label |  appearance  |
        |-------------------------|--------------|-------|--------------|
        | begin group             | skore        |       | field-list   |
        | select_one skorechoices | skore_header | Score | label        |
        | select_one skorechoices | skr1         | Q1    | list-nolabel |
        | select_one skorechoices | skr2         | Q2    | list-nolabel |
        | end group               |              |       |              |
        #choices
        |  list name   | name |  label   |
        |--------------|------|----------|
        | skorechoices | c1   | Choice 1 |
        | skorechoices | c2   | Choice 2 |
        """
        self._base_handler = base_handler

    def begin(self, initial_row):
        initial_row_type = initial_row.get('type')
        try:
            self._common_type = 'select_one %s' % initial_row['kobo--score-choices']
            del initial_row['kobo--score-choices']
        except KeyError, e:
            raise KeyError("Row with type: %s must have a column: %s" % (
                    initial_row_type,
                    'kobo--score-choices',
                ))
        _name = initial_row.get('name')
        initial_row.update({
            'type': self._common_type,
            'name': '%s_header' % _name,
            'appearance': 'label',
            })

        self._rows = [
            {
                'type': 'begin group',
                'name': _name,
                'appearance': 'field-list',
            },
            initial_row,
        ]

    def add_row(self, row):
        appearance = row.get('appearance') or 'list-nolabel'
        row.update({'type': self._common_type,
                    'appearance': appearance,})
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
            raise TypeError("'%s': KoboScore groups can only contain rows with type='score__row' (or 'end score')" % row.get('type'))

KOBO_CUSTOM_TYPE_HANDLERS = {
    'begin score': KoboScoreGroup,
    'begin rank': KoboRankGroup,
}

def _sluggify_valid_xml(name):
    out = re.sub('\W+', '_', name.strip().lower())
    if re.match(r'^\d', out):
        out = '_'+out
    return out

def _increment(name):
    return name + '_0'

def _rand_id(n):
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(n))

def _autoname_fields(surv_contents, default_language=None):
    '''
    if any names are not set, automatically fill them in
    '''
    kuid_names = {}
    for surv_row in surv_contents:
        if not 'name' in surv_row:
            if re.search(r'^end ', surv_row['type']):
                continue
            if 'label' in surv_row:
                next_name = _sluggify_valid_xml(surv_row['label'])
            elif default_language is not None:
                next_name = _sluggify_valid_xml(surv_row['label::%s' % default_language])
            else:
                raise ValueError('Label cannot be translated: %s' % json.dumps(surv_row))
            surv_row['name'] = next_name
            while next_name in kuid_names.values():
                next_name = _increment(next_name)
            if 'kuid' not in surv_row:
                surv_row['kuid'] = _rand_id(8)
            if surv_row['kuid'] in kuid_names:
                raise Exception("Duplicate kuid: %s" % surv_row['kuid'])
            kuid_names[surv_row['kuid']] = next_name
    return surv_contents


def _autovalue_choices(surv_choices):
    for choice in surv_choices:
        if 'name' not in choice:
            choice['name'] = choice['label']
    return surv_choices

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
            if result == False:
                current_handler = base_handler
    return (base_handler.survey_contents, features_used)

def _is_kobo_specific(name):
    return re.search(r'^kobo--', name)

def convert_any_kobo_features_to_xlsform_survey_structure(surv, **kwargs):
    opts = {
        'autoname': True,
        'autovalue_options': True,
        'extract_rank_and_score': True,
    }
    opts.update(kwargs)

    if 'survey' in surv:
        if opts['autoname']:
            surv['survey'] = _autoname_fields(surv['survey'])
        if opts['extract_rank_and_score']:
            (surv['survey'], features_used) = _parse_contents_of_kobo_structures(surv)

    if 'choices' in surv and opts['autovalue_options']:
        surv['choices'] = _autovalue_choices(surv.get('choices', []))
    for kobo_custom_sheet_name in filter(_is_kobo_specific, surv.keys()):
        del survy[kobo_custom_sheet_name]
    return surv
