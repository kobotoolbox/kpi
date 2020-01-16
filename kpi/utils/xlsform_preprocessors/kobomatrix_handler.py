# coding: utf-8
import re
from functools import reduce

from .base_handlers import GroupHandler


SPAN_WRAP = '<span style="display:none">{}</span>'
HEADER_WRAP = '**{}**'
ROW_HEADER_WRAP = '##### {}'


class KoboMatrixGroupHandler(GroupHandler):
    name = 'Kobo matrix group'

    start_type = 'begin_kobomatrix'
    end_type = 'end_kobomatrix'

    description = '''
    Allows a survey builder to create a table of different question types
    '''

    def __init__(self, base_handler):
        """
        Convert KoboScoreGroup:
        # survey
        |       type       | name | label | kobo--matrix_list | required |
        | ---------------- | ---- | ----- | ----------------- | -------- |
        | begin_kobomatrix | m1   |       | car_bike_tv       |          |
        | select_one yn    | q1   | Q1    |                   | true     |
        | text             | q2   | Q2    |                   | true     |
        | end_kobomatrix   |      |       |                   |          |

        # choices
        |  list name  | name | label |
        | ----------- | ---- | ----- |
        | yn          | yes  | Yes   |
        | yn          | no   | No    |
        | car_bike_tv | car  | Car   |
        | car_bike_tv | bike | Bike  |
        | car_bike_tv | tv   | TV    |

        into:

        # survey
        |      type     |      name      |   label    | appearance | required |
        | ------------- | -------------- | ---------- | ---------- | -------- |
        | begin_group   | m1_header      |            | w7         |          |
        | note          | m1_header_note | **Items**  | w1         | false    |
        | note          | m1_q1          | **Q1**     | w2         | false    |
        | note          | m1_q2          | **Q2**     | w2         | false    |
        | end_group     |                |            |            |          |
        | begin_group   | car            |            | w7         |          |
        | note          | car_note       | ##### Car  | w1         | false    |
        | select_one yn | car_q1         | **Q1**     | w2         | true     |
        | text          | car_q2         | **Q2**     | w2         | true     |
        | end_group     |                |            |            |          |
        | begin_group   | bike           |            | w7         |          |
        | note          | bike_note      | ##### Bike | w1         | false    |
        | select_one yn | bike_q1        | <s>Q1</s1> | w2         | true     |
        | text          | bike_q2        | <s>Q1</s1> | w2         | true     |
        | end_group     |                |            |            |          |
        | begin_group   | tv             |            | w7         |          |
        | note          | tv_note        | ##### TV   | w1         | false    |
        | select_one yn | tv_q1          | <s>Q1</s1> | w2         | true     |
        | text          | tv_q2          | <s>Q1</s1> | w2         | true     |
        | end_group     |                |            |            |          |

        # choices
        | list name   | name | label |
        |-------------|------|-------|
        | yn          | yes  | Yes   |
        | yn          | no   | No    |
        """
        self._base_handler = base_handler

    def begin(self, initial_row):
        super().begin(initial_row)

        choice_key = 'kobo--matrix_list'
        self.items = self._base_handler.choices(list_name=initial_row.pop(choice_key))
        self.item_labels = initial_row.get('label')
        self.span_wrap = initial_row.get('kobomatrix--span-wrap', SPAN_WRAP)
        self.header_wrap = initial_row.get('kobomatrix--header-wrap', HEADER_WRAP)
        self.row_header_wrap = initial_row.get('kobomatrix--row-header-wrap', ROW_HEADER_WRAP)
        self._rows = []

    def finish(self):
        survey_contents = self._base_handler.survey_contents

        first_column_width = 1
        total_width = reduce(lambda n, r: n + r.get('_column_width'),
                             self._rows,
                             first_column_width)

        total_width = 'w{}'.format(total_width)
        first_column_width = 'w{}'.format(first_column_width)

        for item in self._header(self.name, self.item_labels, self._rows,
                                 total_width=total_width,
                                 first_column_width=first_column_width,
                                 ):
            survey_contents.append(item)

        for item in self.items:
            for row in self._rows_for_item(self.name, item, self._rows,
                                           total_width,
                                           first_column_width,
                                           ):
                survey_contents.append(row)

    def _format_all_labels(self, labels, template):
        return [
            template.format(_l) if _l is not None else None for _l in labels
        ]

    @staticmethod
    def _name_or_autoname(col):
        name = col.get('name')
        if not name:
            name = col.get('$autoname')
        if not name:
            raise Exception('Column has neither `name` nor `$autoname`')
        return name

    @staticmethod
    def _name_or_autovalue(item):
        name = item.get('name')
        if not name:
            name = item.get('$autovalue')
        if not name:
            raise Exception('Item has neither `name` nor `$autovalue`')
        return name

    def _header(self, name, items_label, cols,
                total_width,
                first_column_width='w1',
                ):
        header_name = '_'.join([name, 'header'])

        start = [{'type': 'begin_group',
                  'name': header_name,
                  'appearance': total_width,
                  },
                 {'type': 'note',
                  'name': '{}_note'.format(header_name),
                  'appearance': first_column_width,
                  'required': False,
                  'label': self._format_all_labels(items_label, self.header_wrap),
                  }]

        mids = [
            {'type': 'note',
             'appearance': 'w{}'.format(col.get('_column_width')),
             'required': False,
             'label': self._format_all_labels(col.get('label'), self.header_wrap),
             'name': '_'.join([header_name, self._name_or_autoname(col)])
             }
            for col in cols
        ]
        return start + mids + [{'type': 'end_group'}]

    def _rows_for_item(self, name, item, cols,
                       total_width,
                       first_column_width='w1',
                       ):
        _item_name = self._name_or_autovalue(item)
        _base_name = '_'.join([name, _item_name])
        start = [{'type': 'begin_group',
                  'name': _base_name,
                  'appearance': total_width,
                  },
                 {'type': 'note',
                  'name': '{}_note'.format(_base_name),
                  'label': self._format_all_labels(item.get('label'),
                                                   self.row_header_wrap),
                  'required': False,
                  'appearance': first_column_width,
                  }]

        mappings = dict([(
                '${%s}' % col['$autoname'],
                '${%s}' % '%s_%s' % (_base_name, col['$autoname'],),
            ) for col in cols])

        def _make_row(col):
            _type = col['type']
            _appearance = ['w{}'.format(col.get('_column_width'))]
            if _type in ['select_one', 'select_multiple']:
                _appearance.append('horizontal-compact')
            else:
                _appearance.append('no-label')
            _labels = []
            for _label in col.get('label'):
                if _label is not None:
                    _labels.append('-'.join([_item_name, _label]))
                else:
                    _labels.append(None)
            out = {'type': _type,
                   'name': '_'.join([_base_name, self._name_or_autoname(col)]),
                   'appearance': ' '.join(_appearance),
                   'label': self._format_all_labels(_labels, self.span_wrap),
                   'required': col.get('required', False),
                   }
            for key in ['relevant', 'constraint', 'required']:
                if key in col and isinstance(col[key], str):
                    _str = col[key]
                    for (key2, val) in mappings.items():
                        if key2 in _str:
                            _str = _str.replace(key2, val)
                    out[key] = _str
                elif key in col:
                    out[key] = col[key]

            if 'select_from_list_name' in col:
                out['select_from_list_name'] = col['select_from_list_name']
            return out

        return start + [_make_row(col) for col in cols] + [{'type': 'end_group'}]

    def handle_row(self, row):
        if row.get('type') == self.end_type:
            self.finish()
            return False
        else:
            _appearance_re = re.match(r'^w(\d+)$', row.get('appearance', ''))
            row['_column_width'] = 2 if not _appearance_re else int(_appearance_re.groups()[0])
            self._rows.append(row)
            return self
