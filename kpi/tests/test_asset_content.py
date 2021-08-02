# coding: utf-8
import inspect
import json
import string
from collections import OrderedDict
from copy import deepcopy
from functools import reduce

from kpi.models import Asset
from kpi.utils.sluggify import sluggify_label


def test_expand_twice():
    a1 = Asset(asset_type='survey', content={'survey': [{'type': 'note',
                                             'label::English': 'english',
                                             'hint::English': 'hint',
                                             }]})
    a1.adjust_content_on_save()
    assert 'translations' in a1.content
    assert len(a1.content['translations']) > 0
    assert 'translated' in a1.content
    assert len(a1.content['translated']) > 0
    assert sorted(a1.content['translated']) == ['hint', 'label']


def _asset_constructor(fn):
    def _new(): return Asset(asset_type='survey', content=fn())
    return _new


def rank_asset_content():
    return {
        'survey': [
            {'type': 'begin_rank', 'label': 'Top 3 needs?',
                'kobo--rank-items': 'needs',
                'kobo--rank-constraint-message': 'Rank these things'},
            {'type': 'rank__level', 'label': '1st need'},
            {'type': 'rank__level', 'label': '2nd need'},
            {'type': 'rank__level', 'label': '3rd need'},
            {'type': 'end_rank'}
        ],
        'choices': [
            {'list_name': 'needs', 'label': 'Food'},
            {'list_name': 'needs', 'label': 'Water'},
            {'list_name': 'needs', 'label': 'Shelter'},
        ],
        'settings': {},
    }


def rank_asset_named_content():
    return {
        'survey': [
            {'type': 'begin_rank', 'label': 'Top 3 needs?',
                'name': 'rank_q',
                'kobo--rank-items': 'needs',
                'kobo--rank-constraint-message': 'Rank these things'},
            {'type': 'rank__level', 'label': '1st need', 'name': 'r1'},
            {'type': 'rank__level', 'label': '2nd need', 'name': 'r2'},
            {'type': 'rank__level', 'label': '3rd need', 'name': 'r3'},
            {'type': 'end_rank'}
        ],
        'choices': [
            {'list_name': 'needs', 'label': 'Food', 'name': 'fd'},
            {'list_name': 'needs', 'label': 'Water', 'name': 'h2o'},
            {'list_name': 'needs', 'label': 'Shelter', 'name': 'sh'},
        ],
        'settings': {},
    }


def score_asset_content():
    return {
        'survey': [
            {'kobo--score-choices': 'nb7ud55',
             'label': ['Rate Los Angeles'],
             'required': True,
             'type': 'begin_score'},
            {'label': ['Food'], 'type': 'score__row'},
            # {'label': ['Music'], 'type': 'score__row'},
            # {'label': ['Night life'], 'type': 'score__row'},
            # {'label': ['Housing'], 'type': 'score__row'},
            # {'label': ['Culture'], 'type': 'score__row'},
            {'type': 'end_score'}],
        'choices': [
            # {'label': ['Great'],
            #  'list_name': 'nb7ud55'},
            {'label': ['OK'],
             'list_name': 'nb7ud55'},
            # {'label': ['Bad'],
            #  'list_name': 'nb7ud55'}
        ],
    }


score_asset = _asset_constructor(score_asset_content)


def color_picker_asset_content():
    return {
        'survey': [
            {'type': 'select_multiple', 'label': 'select colors',
             'select_from_list_name': 'colors'}
        ],
        'choices': [
            {'list_name': 'colors', 'label': 'Red'},
            {'list_name': 'colors', 'label': 'Yellow'},
            {'list_name': 'colors', 'label': 'Blue'},
        ],
        'settings': {
            'form_title': 'color picker',
            'id_string': 'colorpik',
        }
    }


color_picker_asset = _asset_constructor(color_picker_asset_content)


def nonstandard_asset():
    return Asset(asset_type='survey', content={
        'survey': [
            {'type': 'select_one abc', 'Label': 'select a letter'},
            # todo: handle certain "expand" features after aliases are replaced
            # {'type': 'select1 abc', 'Label': 'select a letter'},
            {},
            {'misc_value': 'gets removed by _strip_empty_rows'},
        ],
        'choices': [
            {'list name': 'abc', 'label': letter}
             for letter in string.ascii_lowercase
        ]
    })


def jprint(c):
    print(json.dumps(c, indent=2))


def _r1(content, sheet_name='survey'):
    return content[sheet_name][0]


def _is_lambda(v):
    LAMBDA_TYPE = type(lambda: 0)
    return isinstance(v, LAMBDA_TYPE) and v.__name__ == '<lambda>'


def for_each_row(content, *args):
    sheet_names = ['survey', 'choices']
    if isinstance(args[0], str):
        _pass_sheet_name = False
        sheet_names = [args[0]]
        fn = args[1]
    else:
        _pass_sheet_name = True
        fn = args[0]
    _lambda = _is_lambda(fn)
    for _sheet_name in sheet_names:
        for row in content[_sheet_name]:
            args = [row]
            if _pass_sheet_name:
                args.append(_sheet_name)
            if _lambda:
                if not fn(*args):
                    raise AssertionError('"{}" failed on row: {}'.format(
                                                inspect.getsource(fn).strip(),
                                                json.dumps(row, indent=2)
                                            )
                                         )
            else:
                fn(*args)


def test_standardization_of_nonstandard_asset():
    a1 = nonstandard_asset()
    # standardize returns True if it passed the content through to the
    # "standardize_content_in_place()" method.
    assert a1._standardize(a1.content)

    # all content has a settings dict
    assert 'settings' in a1.content
    assert isinstance(a1.content['settings'], dict)

    # "Label" is changed to "label"
    assert 'label' in _r1(a1.content)
    assert _r1(a1.content)['type'] == 'select_one'
    assert _r1(a1.content)['select_from_list_name'] == 'abc'
    # $kuid has not been assigned yet
    for_each_row(a1.content, lambda row, s: '$kuid' not in row)
    for_each_row(a1.content, lambda row, s: 'name' not in row)

    # "list name" is changed to "list_name"
    assert 'list_name' in _r1(a1.content, 'choices')

    a1._strip_empty_rows(a1.content)
    assert len(a1.content['survey']) == 1

    # kuids are set
    a1._assign_kuids(a1.content)
    for_each_row(a1.content, lambda row, s: '$kuid' in row)

    # $autoname and $autovalue are set in `_autoname(...)`
    for_each_row(a1.content, 'survey', lambda row: '$autoname' not in row)
    for_each_row(a1.content, 'choices', lambda row: '$autovalue' not in row)
    a1._autoname(a1.content)
    for_each_row(a1.content, 'survey', lambda row: '$autoname' in row)
    for_each_row(a1.content, 'choices', lambda row: '$autovalue' in row)
    # at this point, asset.save() is complete.


def test_autoname_shortens_long_names():
    def _name_to_autoname(rows):
        s = Asset(asset_type='survey', content={})
        rows = [dict({'type': 'text'}, **row) for row in rows]
        content = {'survey': rows}
        s._autoname(content)
        return [r['$autoname'] for r in content.get('survey', [])]

    LONG_NAME = ('four_score_and_seven_years_ago_our_fathers_brought_forth_on_'
                 'this_continent')

    # names are not shortened by default, because they were explicitly set
    assert _name_to_autoname([{'name': LONG_NAME}]) == [LONG_NAME]

    # if there is a name conflict we should throw a meaningful error
    # however, since this behavior is already present, it might be
    # impossible to transition existing valid forms
    # with pytest.raises(ValueError):
    #     _name_to_autoname([
    #         {'name': LONG_NAME},
    #         {'name': LONG_NAME},
    #     ])

    long_label = ('Four score and seven years ago, our fathers brought forth'
                  ' on this continent')
    assert _name_to_autoname([
        {'label': long_label},
        {'label': long_label},
    ]) == [
        'Four_score_and_seven_th_on_this_continent',
        'Four_score_and_seven_th_on_this_continent_001',
    ]

    assert _name_to_autoname([{'label': x} for x in [
        "What is your favorite all-time place to go swimming?",
        "What is your favorite all-time place to go running?",
        "What is your favorite all-time place to go to relax?",
    ]]) == ['What_is_your_favorit_place_to_go_swimming',
            'What_is_your_favorit_place_to_go_running',
            'What_is_your_favorit_place_to_go_to_relax']


def test_remove_empty_expressions():
    a1 = Asset(asset_type='survey', content={})

    c1 = {'survey': [{'relevant': ''}]}
    a1._remove_empty_expressions(c1)
    assert _r1(c1) == {}

    c1 = {'survey': [{'bind': None}]}
    a1._remove_empty_expressions(c1)
    assert _r1(c1) == {}


def test_save_transformations():
    a1 = Asset(asset_type='survey', content={})

    content = color_picker_asset_content()
    a1._standardize(content)
    a1._strip_empty_rows(content)
    a1._assign_kuids(content)
    form_title = a1.pop_setting(content, 'form_title')
    a1._autoname(content)
    assert 'schema' in content
    assert content['translations'] == [None]
    assert form_title == 'color picker'
    assert content['settings'] == {'id_string': 'colorpik'}
    # save complete!


def _compile_asset_content(content):
    a1 = Asset(asset_type='survey', content={})
    a1._standardize(content)
    a1._strip_empty_rows(content)
    a1._assign_kuids(content)
    form_title = a1.pop_setting(content, 'form_title', 'a backup title')
    a1._autoname(content)
    assert form_title == 'a backup title'
    # at this stage, the save is complete

    a1._expand_kobo_qs(content)
    a1._autoname(content)
    a1._assign_kuids(content)
    return content


def _score_item(_r):
    r = deepcopy(_r)
    return [
        r.pop('type'),
        r.pop('$autoname', False),
        ' '.join(sorted(r.keys())),
    ]


def test_sluggify_arabic():
    # this "_" value will get replaced with something else by `autoname`
    ll = sluggify_label('مرحبا بالعالم')
    assert ll == '_'

    ll = sluggify_label('بالعالم')
    assert ll == '_'


def test_rank_to_xlsform_structure():
    # a1 = Asset(asset_type='survey', content={})
    content = _compile_asset_content(rank_asset_content())
    _rows = [[_r.get('name'), _r.get('$autoname'), _r.get('type'),
             _r.get('appearance')]
             for _r in content['survey']]
    assert _rows[0:3] == [
    #   name             $_autoname      type            appearance
        ['Top_3_needs', 'Top_3_needs', 'begin_group', 'field-list'],
        ['Top_3_needs_label', 'Top_3_needs_label', 'note', None],
        [None, '_1st_need', 'select_one', 'minimal'],
    ]
    assert _rows[5] == [None, None, 'end_group', None]


def test_named_rank_to_xlsform_structure():
    # a1 = Asset(asset_type='survey', content={})
    content = _compile_asset_content(rank_asset_named_content())
    _rows = [[_r.get('name'), _r.get('$autoname'), _r.get('type'),
             _r.get('appearance')]
             for _r in content['survey']]
    assert len(_rows[0:3]) == 3
    assert _rows[0:3] == [
    #   name        $_autoname type            appearance
        ['rank_q', 'rank_q', 'begin_group', 'field-list'],
        ['rank_q_label', 'rank_q_label', 'note', None],
        ['r1', 'r1', 'select_one', 'minimal'],
    ]
    assert _rows[5] == [None, None, 'end_group', None]


def test_score_to_xlsform_structure():
    a1 = score_asset()
    content = _compile_asset_content(score_asset_content())
    a1._populate_fields_with_autofields(content)
    assert content['settings'] == {}
    a1._append(content, settings={
        'style': 'pages',
    })
    content = OrderedDict(content)
    a1._xlsform_structure(content, ordered=True)

    # ensure 'schema' sheet is removed
    assert list(content.keys()) == ['survey', 'choices', 'settings']

    _rows = content['survey']
    for row in _rows:
        assert list(row.keys()) == ['type', 'name', 'label', 'appearance',
                                    'required']

    def _drws(n):
        return dict(_rows[n])

    assert _drws(0) == {'type': 'begin_group',
                        'appearance': 'field-list',
                        'label': None,
                        'required': None,
                        'name': 'Rate_Los_Angeles',
                        }
    assert _drws(1) == {'type': 'select_one nb7ud55',
                        'appearance': 'label',
                        'required': None,
                        'name': 'Rate_Los_Angeles_header',
                        'label': 'Rate Los Angeles',
                        }
    assert _drws(2) == {'type': 'select_one nb7ud55',
                        'appearance': 'list-nolabel',
                        'name': 'Food',
                        'label': 'Food',
                        'required': 'true',
                        }


def test_score_question_compiles():
    content = _compile_asset_content(score_asset_content())
    _rows = content['survey']

    assert _rows[0]['name'] == 'Rate_Los_Angeles'
    assert _rows[1]['name'] == 'Rate_Los_Angeles_header'
    assert _rows[2]['$autoname'] == 'Food'

    assert ([_score_item(r) for r in _rows]) == [
        ['begin_group', 'Rate_Los_Angeles',
            '$kuid appearance name'],
        ['select_one', 'Rate_Los_Angeles_header',
            '$kuid appearance label name select_from_list_name'],
        ['select_one', 'Food',
            '$kuid appearance label required select_from_list_name'],
        ['end_group', False,
            '$kuid']
    ]


def test_named_score_question_compiles():
    content = _compile_asset_content({
        'survey': [
            {'kobo--score-choices': 'nb7ud55',
             'label': ['Rate Los Angeles'],
             'required': True,
             'name': 'skore',
             'type': 'begin_score'},

            {'label': ['Food'], 'type': 'score__row'},

            {'type': 'end_score'}],
        'choices': [
            {'label': ['OK'],
             'list_name': 'nb7ud55'},
        ],
    })

    _rows = content['survey']
    assert _rows[0]['name'] == 'skore'
    assert _rows[1]['name'] == 'skore_header'
    assert _rows[2]['$autoname'] == 'Food'

    def _score_item(_r):
        r = deepcopy(_r)
        return [
            r.pop('type'),
            r.pop('$autoname', False),
            ' '.join(sorted(r.keys())),
        ]

    assert ([_score_item(r) for r in _rows]) == [
        ['begin_group', 'skore',
            '$kuid appearance name'],
        ['select_one', 'skore_header',
            '$kuid appearance label name select_from_list_name'],
        ['select_one', 'Food',
            '$kuid appearance label required select_from_list_name'],
        ['end_group', False,
            '$kuid']
    ]


def kobomatrix_content():
    return {
        'survey': [
            {'type': 'begin_kobomatrix',
                'name': 'm1',
                'label': 'Itéms',
                'kobo--matrix_list': 'car_bike_tv',
             },
            {'type': 'select_one', 'select_from_list_name': 'yn',
             'constraint': '. = "yes"',
             'label': 'Possess?', 'name': 'possess', 'required': True},
            {'type': 'select_one', 'select_from_list_name': 'yn',
             'label': 'Necessary?', 'name': 'necess', 'required': True},
            {'type': 'integer',
             'label': 'Number', 'name': 'number', 'required': True},
            {'type': 'end_kobomatrix'},
        ],
        'choices': [
            {'list_name': 'car_bike_tv', 'label': 'Car', 'name': 'car'},
            {'list_name': 'car_bike_tv', 'label': 'Bike', 'name': 'bike'},
            {'list_name': 'car_bike_tv', 'label': 'TV', 'name': 'tv'},
            {'list_name': 'yn', 'label': 'Yes', 'name': 'yes'},
            {'list_name': 'yn', 'label': 'No', 'name': 'no'},
        ],
        'settings': {},
    }


def kobomatrix_content_with_custom_fields():
    _content = kobomatrix_content()
    _survey = _content['survey']
    _survey[2].update({'required': "${possess} = 'yes'"})
    _survey[3].update({'constraint': '. > 3'})
    return _content


def reverse_str(s):
    return ''.join(reversed(s))


def kobomatrix_content_with_translations():
    _content = kobomatrix_content()
    for _s in ['survey', 'choices']:
        _sheet = _content[_s]
        for _row in _sheet:
            try:
                _label = _row['label']
            except KeyError:
                continue
            _row['label::English'] = _label
            _row['label::' + reverse_str('English')] = reverse_str(_label)
            del _row['label']
    return _content


def kobomatrix_content_with_missing_translations():
    _content = kobomatrix_content_with_translations()
    for _s in ['survey', 'choices']:
        _sheet = _content[_s]
        found_first_translation = False
        for _row in _sheet:
            try:
                _label = _row['label::English']
            except KeyError:
                continue
            if not found_first_translation:
                # leave the first translation alone
                found_first_translation = True
                continue
            _row['label::' + reverse_str('English')] = None
    return _content


def _span_display_none(item):
    return '<span style="display:none">{}</span>'.format(item)


def test_kobomatrix_content():
    content = _compile_asset_content(kobomatrix_content())
    pattern = ['w7', 'w1', 'w2', 'w2', 'w2', '']
    _survey = content.get('survey')
    _names = [r.get('name') for r in _survey]
    _constraints = [r.get('constraint') for r in _survey]
    _labls = [r.get('label', [None])[0] for r in _survey]
    _none_labels = [label is None for label in _labls]
    _reqds = [r.get('required', None) for r in _survey]

    # assert constraints are not dropped
    assert set(_constraints) == set([None, '. = "yes"'])

    # appearance fields match
    assert [r.get('appearance', '').split(' ')[0] for r in _survey] == (
            pattern * 4)
    _appearances = [r.get('appearance') for r in _survey]
    assert _appearances[7:11] == ['w1',
                                  'w2 horizontal-compact',
                                  'w2 horizontal-compact',
                                  'w2 no-label',
                                  ]
    assert _appearances[13:17] == ['w1',
                                   'w2 horizontal-compact',
                                   'w2 horizontal-compact',
                                   'w2 no-label',
                                   ]
    assert _appearances[19:23] == ['w1',
                                   'w2 horizontal-compact',
                                   'w2 horizontal-compact',
                                   'w2 no-label',
                                   ]

    # names match
    assert _names == ['m1_header',
                      'm1_header_note',
                      'm1_header_possess',
                      'm1_header_necess',
                      'm1_header_number',
                      None,
                      'm1_car',
                      'm1_car_note',
                      'm1_car_possess',
                      'm1_car_necess',
                      'm1_car_number',
                      None,
                      'm1_bike',
                      'm1_bike_note',
                      'm1_bike_possess',
                      'm1_bike_necess',
                      'm1_bike_number',
                      None,
                      'm1_tv',
                      'm1_tv_note',
                      'm1_tv_possess',
                      'm1_tv_necess',
                      'm1_tv_number',
                      None,
                      ]

    assert _none_labels == [True, False, False, False, False, True] * 4
    assert _labls[1:5] == ['**Itéms**',
                           '**Possess?**',
                           '**Necessary?**',
                           '**Number**',
                           ]

    assert _labls[7:11] == ['##### Car',
                            _span_display_none('car-Possess?'),
                            _span_display_none('car-Necessary?'),
                            _span_display_none('car-Number'),
                            ]
    assert _labls[13:17] == ['##### Bike',
                             _span_display_none('bike-Possess?'),
                             _span_display_none('bike-Necessary?'),
                             _span_display_none('bike-Number'),
                             ]
    assert _labls[19:23] == ['##### TV',
                             _span_display_none('tv-Possess?'),
                             _span_display_none('tv-Necessary?'),
                             _span_display_none('tv-Number'),
                             ]
    assert _reqds == [None, False, False, False, False, None] + (
                        [None, False, True, True, True, None] * 3
                    )


def test_kobomatrix_labels_with_translations():
    content = _compile_asset_content(
        kobomatrix_content_with_translations())
    labels = [r.get('label', [None]) for r in content['survey']]

    expected_labels = [
        '**It\xe9ms**',
        '**Possess?**',
        '**Necessary?**',
        '**Number**'
    ]
    assert labels[1:5] == [[l, reverse_str(l)] for l in expected_labels]

    def _make_expected_labels(row):
        labels = [['##### ' + row, '##### ' + reverse_str(row)]]
        for col in ['Possess?', 'Necessary?', 'Number']:
            labels.append([
                _span_display_none(row.lower() + '-' + col),
                _span_display_none(row.lower() + '-' + reverse_str(col))
            ])
        return labels

    assert labels[7:11] == _make_expected_labels('Car')
    assert labels[13:17] == _make_expected_labels('Bike')
    assert labels[19:23] == _make_expected_labels('TV')


def test_kobomatrix_labels_with_missing_translations():
    content = _compile_asset_content(
        kobomatrix_content_with_missing_translations())
    labels = [r.get('label', [None]) for r in content['survey']]
    assert labels[1:5] == [
        ['**It\xe9ms**', '**sm\xe9tI**'],
        ['**Possess?**', None],
        ['**Necessary?**', None],
        ['**Number**', None]
    ]
    assert labels[7:11] == [
        ['##### Car', '##### raC'],
        [_span_display_none('car-Possess?'), None],
        [_span_display_none('car-Necessary?'), None],
        [_span_display_none('car-Number'), None]
    ]
    assert labels[13:17] == [
        ['##### Bike', None],
        [_span_display_none('bike-Possess?'), None],
        [_span_display_none('bike-Necessary?'), None],
        [_span_display_none('bike-Number'), None]
    ]
    assert labels[19:23] == [
        ['##### TV', None],
        [_span_display_none('tv-Possess?'), None],
        [_span_display_none('tv-Necessary?'), None],
        [_span_display_none('tv-Number'), None]
    ]


def test_xpath_fields_in_kobomatrix_are_preserved():
    _content = kobomatrix_content_with_custom_fields()
    (r0, r1, r2, r3, r4) = _content['survey']
    assert r2['required'] == "${possess} = 'yes'"
    assert r3['constraint'] == '. > 3'

    compiled_content = _compile_asset_content(_content)
    assert len(compiled_content['survey']) == 24
    _survey_content = compiled_content['survey']

    def _necess_reqs(_set, item):
        _req = item.get('required')
        if item.get('name', '').endswith('_necess') and _req:
            _set.update([_req])
        return _set

    def _possess_constraints(_set, item):
        _constraint = item.get('constraint')
        _set.update([_constraint])
        return _set

    assert reduce(_possess_constraints, _survey_content, set()) == set([
        None,
        '. = "yes"',
        '. > 3',
    ])

    assert reduce(_necess_reqs, _survey_content, set()) == set([
        "${m1_bike_possess} = 'yes'",
        "${m1_car_possess} = 'yes'",
        "${m1_tv_possess} = 'yes'",
    ])


def test_kobomatrix_missing_or_empty_names():
    """
    Test a mixture of survey elements containing:
        * An `$autoname` but no `name`;
        * An `$autoname` and an empty `name`;
        * An `$autovalue` and an empty `name`;
        * An `$autovalue` and no `name`.
    """
    content = {
        'survey': [
            {'type': 'begin_kobomatrix', 'kobo--matrix_list': 'matrix_qt2dy33',
             'label': ['Which of the following do you have in this Community'],
             'appearance': 'field-list', '$autoname': 'group_za0zh02',
             '$kuid': '22ddef30', 'name': 'group_za0zh02'},
            {'type': 'text', 'hint': [''], 'label': ['Yes'],
             'appearance': 'w1', '$autoname': 'Yes', '$kuid': '369ccabe',
             'required': False},
            {'type': 'text', 'hint': [''], 'label': ['No'], 'appearance': 'w1',
             '$autoname': 'No', '$kuid': 'ea3ddb55', 'required': False},
            {'type': 'text', 'hint': [''], 'label': ["Don't Know"],
             'appearance': 'w1', '$autoname': 'Don_t_Know',
             '$kuid': '86f5ce6e', 'required': False, 'name': ''},
            {'type': 'end_kobomatrix', '$kuid': 'ab229229'},
        ],
        'choices': [
            {'label': ['Local Market'], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Local_Market', '$kuid': 'jw0bj37', 'name': ''},
            {'label': ['Primary school'], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Primary_school', '$kuid': 'tm79f82', 'name': ''},
            {'label': ['Secondary school'], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Secondary_school', '$kuid': 'pv5yb79',
             'name': ''},
            {'label': ['Health Centre'], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Health_Centre', '$kuid': 'rt02z25'},
            {'label': ['Public Tap Water '], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Public_Tap_Water_', '$kuid': 'iz2kb60'},
            {'label': ['Bank'], 'list_name': 'matrix_qt2dy33',
             '$autovalue': 'Bank', '$kuid': 'gm98s12'},
        ]
    }
    standardized = _compile_asset_content(content)
    types_names = [(x['type'], x.get('name')) for x in standardized['survey']]
    expected_types_names = [
        ('begin_group', 'group_za0zh02_header'),
        ('note', 'group_za0zh02_header_note'),
        ('note', 'group_za0zh02_header_Yes'),
        ('note', 'group_za0zh02_header_No'),
        ('note', 'group_za0zh02_header_Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Local_Market'),
        ('note', 'group_za0zh02_Local_Market_note'),
        ('text', 'group_za0zh02_Local_Market_Yes'),
        ('text', 'group_za0zh02_Local_Market_No'),
        ('text', 'group_za0zh02_Local_Market_Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Primary_school'),
        ('note', 'group_za0zh02_Primary_school_note'),
        ('text', 'group_za0zh02_Primary_school_Yes'),
        ('text', 'group_za0zh02_Primary_school_No'),
        ('text', 'group_za0zh02_Primary_school_Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Secondary_school'),
        ('note', 'group_za0zh02_Secondary_school_note'),
        ('text', 'group_za0zh02_Secondary_school_Yes'),
        ('text', 'group_za0zh02_Secondary_school_No'),
        ('text', 'group_za0zh02_Secondary_school_Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Health_Centre'),
        ('note', 'group_za0zh02_Health_Centre_note'),
        ('text', 'group_za0zh02_Health_Centre_Yes'),
        ('text', 'group_za0zh02_Health_Centre_No'),
        ('text', 'group_za0zh02_Health_Centre_Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Public_Tap_Water_'),
        ('note', 'group_za0zh02_Public_Tap_Water__note'),
        ('text', 'group_za0zh02_Public_Tap_Water__Yes'),
        ('text', 'group_za0zh02_Public_Tap_Water__No'),
        ('text', 'group_za0zh02_Public_Tap_Water__Don_t_Know'),
        ('end_group', None),
        ('begin_group', 'group_za0zh02_Bank'),
        ('note', 'group_za0zh02_Bank_note'),
        ('text', 'group_za0zh02_Bank_Yes'),
        ('text', 'group_za0zh02_Bank_No'),
        ('text', 'group_za0zh02_Bank_Don_t_Know'),
        ('end_group', None)
    ]
    assert types_names == expected_types_names


def test_required_value_can_be_a_string():
    content = _compile_asset_content({
        'survey': [
            {'type': 'text', 'name': 'abc'},
            {'type': 'text', 'name': 'req_if_abc', 'required': "${abc} != ''"},
        ],
    })
    r2 = content['survey'][1]
    assert r2['required'] == "${abc} != ''"


def test_kuid_persists():
    initial_kuid_1 = 'aaaa1111'
    initial_kuid_2 = 'bbbb2222'

    asset = Asset(content={
        'survey': [
            {'type': 'text', 'name': 'abc', '$kuid': initial_kuid_1},
            {'type': 'text', 'name': 'def', '$kuid': initial_kuid_2},
        ],
    })
    # kobo_specific_types=True avoids calling _strip_kuids
    # so, can we assume that kuids are supposed to remain?
    content = asset.ordered_xlsform_content(kobo_specific_types=True)
    # kuids are stripped in "kobo_to_xlsform.to_xlsform_structure(...)"

    assert '$kuid' in content['survey'][0]
    assert content['survey'][0].get('$kuid') == initial_kuid_1
    assert '$kuid' in content['survey'][1]
    assert content['survey'][1].get('$kuid') == initial_kuid_2
