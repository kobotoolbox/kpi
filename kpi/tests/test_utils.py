# coding: utf-8
from copy import deepcopy

from django.db.models import Q
from django.test import TestCase

from kpi.exceptions import SearchQueryTooShortException
from kpi.constants import ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS
from kpi.utils.autoname import autoname_fields, autoname_fields_to_field
from kpi.utils.autoname import autovalue_choices_in_place
from kpi.utils.query_parser import parse, ParseError
from kpi.utils.sluggify import sluggify, sluggify_label


class UtilsTestCase(TestCase):
    def test_sluggify(self):
        inp_exps = [
            ['A B C', 'a_b_c'],
            # add examples here...
        ]
        for strs in inp_exps:
            if len(strs) > 2:
                opts = strs[3]
            else:
                opts = {}
            _converted = sluggify(strs[0], opts)
            self.assertEqual(strs[1], _converted)

    def test_sluggify_label(self):
        inp_exps = [
            [["asdf jkl"],              "asdf_jkl"],
            [["asdf", ["asdf"]],        "asdf_001"],
            [["2. asdf"],               "_2_asdf"],
            [["2. asdf", ["_2_asdf"]],  "_2_asdf_001"],
            [["asdf#123"],              "asdf_123"],
            [[" hello "],               "hello"],
            # FIX THIS when we come up with a better way to summarize
            # arabic and cyrillic text
            [["أين السوق؟", ["_", "__001"]],  "__002"]
        ]
        for inps, expected in inp_exps:
            inp = inps[0]
            if len(inps) > 1:
                other_names = inps[1]
            else:
                other_names = []
            _converted = sluggify_label(inp, other_names=other_names)
            self.assertEqual(expected, _converted)

    def _assertAutonames(self, names, expected):
        # provide an easy way to check inputs and outputs of autonamer
        arr = []
        for name in names:
            if isinstance(name, dict):
                row = name
            else:
                row = {'type': 'text', 'label': name, '$kuid': 'kUiD'}
            arr.append(row)
        _content = deepcopy({'survey': arr})
        _named = autoname_fields(_content, in_place=False)
        self.assertEqual(expected, [r['name'] for r in _named])
        _politely = autoname_fields_to_field(_content, to_field='$autoname')
        _polite_names = [field.get('$autoname')
                         for field in _politely.get('survey')]
        self.assertEqual(_polite_names, [r['name'] for r in _named])

    def test_autonamer(self):
        self._assertAutonames(
            names=[
                'abc',
                'def',
                None,
                'jwef',
            ], expected=[
                'abc',
                'def',
                'text_kUiD',
                'jwef',
            ])
        self._assertAutonames(
            names=[
                'abc',
                'abc',
                'abc',
            ], expected=[
                'abc',
                'abc_001',
                'abc_002',
            ])
        self._assertAutonames(
            names=[
                'abc',
                {'name': 'abc_002', 'type': 'note'},
                'abc',
                'abc',
            ], expected=[
                'abc',
                'abc_002',
                'abc_001',
                'abc_003',
            ])
        self._assertAutonames(
            names=[
                {'label': 'abc', 'type': 'text'},
                {'label': 'abc', 'type': 'text'},
                {'label': 'abc', 'type': 'text'},
            ], expected=[
                'abc',
                'abc_001',
                'abc_002',
            ])

    def test_autovalue_choices(self):
        surv = {
            'survey': [
                {'type': 'select_multiple',
                 'select_from_list_name': 'xxx'},
            ],
            'choices': [
                {'list_name': 'xxx', 'label': 'A B C'},
                {'list_name': 'xxx', 'label': 'D E F'},
            ],
            'settings': {},
        }
        autovalue_choices_in_place(surv, destination_key='$autovalue')
        self.assertEqual(surv['choices'][0]['$autovalue'], 'A_B_C')

    def test_autovalue_does_not_change_when_name_exists(self):
        surv = {
            'choices': [
                {'list_name': 'xxx', 'label': 'A B C', 'name': 'A__B_C'},
                {'list_name': 'xxx', 'label': 'A B C'},
            ],
        }
        autovalue_choices_in_place(surv, destination_key='$autovalue')
        self.assertEqual(surv['choices'][0]['$autovalue'], 'A__B_C')
        self.assertEqual(surv['choices'][1]['$autovalue'], 'A_B_C')

    def test_autovalue_choices(self):
        surv = {
            'choices': [
                {'list_name': 'xxx', 'label': 'A B C', 'name': 'D_E_F'},
                {'list_name': 'xxx', 'label': 'D E F'},
            ],
        }
        autovalue_choices_in_place(surv, destination_key='$autovalue')
        self.assertEqual(surv['choices'][0]['$autovalue'], 'D_E_F')
        self.assertEqual(surv['choices'][1]['$autovalue'], 'D_E_F_001')

    def test_autovalue_choices_arabic(self):
        surv = {
            'survey': [
                {'type': 'select_multiple',
                 'select_from_list_name': 'xxx'},
            ],
            'choices': [
                {'list_name': 'xxx', 'label': 'العربية'},
                {'list_name': 'xxx', 'label': 'العربية'},
            ],
            'settings': {},
        }
        autovalue_choices_in_place(surv, '$autovalue')
        self.assertEqual(surv['choices'][0]['$autovalue'], 'العربية')
        part1 = 'العربية'
        part2 = '_001'
        self.assertEqual(surv['choices'][1]['$autovalue'], part1 + part2)

    def test_query_parser(self):
        query_string = '''
            (a:a OR b:b AND c:c) AND d:d OR (
                snakes:🐍🐍 AND NOT alphabet:🍲soup
            ) NOT 'in a house' NOT "with a mouse"
        '''
        expected_q = (
            (Q(a='a') | Q(b='b') & Q(c='c')) & Q(d='d') | (
                Q(snakes='🐍🐍') & ~Q(alphabet='🍲soup')
            )
            & ~(
                Q(name__icontains='in a house') |
                Q(owner__username__icontains='in a house') |
                Q(settings__description__icontains='in a house') |
                Q(summary__icontains='in a house') |
                Q(tags__name__icontains='in a house') |
                Q(uid__icontains='in a house')
            )
            & ~(
                Q(name__icontains='with a mouse') |
                Q(owner__username__icontains='with a mouse') |
                Q(settings__description__icontains='with a mouse') |
                Q(summary__icontains='with a mouse') |
                Q(tags__name__icontains='with a mouse') |
                Q(uid__icontains='with a mouse')
            )
        )
        assert (
            expected_q
            == parse(query_string, ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS)
        )

    def test_query_parser_no_specified_field(self):
        query_string = 'foo'
        expected_q = (
            Q(name__icontains='foo') |
            Q(owner__username__icontains='foo') |
            Q(settings__description__icontains='foo') |
            Q(summary__icontains='foo') |
            Q(tags__name__icontains='foo') |
            Q(uid__icontains='foo')
        )
        self.assertEqual(
            repr(expected_q),
            repr(parse(query_string, ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS)),
        )

    def test_query_parser_default_search_too_short(self):
        # if the search query without a field is less than a specified
        # length of characters (currently 3), then it should
        # throw `SearchQueryTooShortException()` from `query_parser.py`
        query_string = 'fo'
        with self.assertRaises(SearchQueryTooShortException) as e:
            parse(query_string, ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS)
        self.assertTrue('Your query is too short' in str(e.exception))
