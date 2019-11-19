# coding: utf-8
from .base_handlers import GroupHandler

COLS = {
    'score-choices': 'kobo--score-choices',
}


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
        super().begin(initial_row)

        begin_group = {
            'type': 'begin_group',
            'appearance': 'field-list',
            'name': self.name
        }

        if 'required' in initial_row:
            self._initial_row_required = initial_row['required']
            del initial_row['required']

        if 'relevant' in initial_row:
            begin_group['relevant'] = initial_row['relevant']
            del initial_row['relevant']

        try:
            choice_colname = initial_row[COLS['score-choices']]
            self._common = {
                'type': 'select_one',
                'select_from_list_name': choice_colname,
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
            row.update({'required': True})
        self._rows.append(row)

    def handle_row(self, row):
        if row.get('type') == 'end_score':
            self._rows.append({
                    'type': 'end_group',
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

