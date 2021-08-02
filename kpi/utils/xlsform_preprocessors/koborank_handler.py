# coding: utf-8
from .base_handlers import GroupHandler

COLS = {
    'rank-cmessage': 'kobo--rank-constraint-message',
    'rank-items': 'kobo--rank-items',
}


class KoboRankGroup(GroupHandler):
    """
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
    """
    name = 'Kobo rank group'
    description = '''Ask a user to rank a number of things.'''

    def begin(self, initial_row):
        super().begin(initial_row)
        self._previous_levels = []

        begin_group = {'type': 'begin_group',
                       'name': self.name,
                       'appearance': 'field-list'}

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

