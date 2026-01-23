import os
import re
from copy import deepcopy

import pytest
from django.conf import settings
from django.db.models import Q
from django.test import RequestFactory, TestCase, override_settings

from kpi.constants import API_NAMESPACES
from kpi.exceptions import (
    QueryParserNotSupportedFieldLookup,
    SearchQueryTooShortException,
)
from kpi.tests.utils.dicts import convert_hierarchical_keys_to_nested_dict
from kpi.utils.autoname import (
    autoname_fields,
    autoname_fields_to_field,
    autovalue_choices_in_place,
)
from kpi.utils.pyxform_compatibility import allow_choice_duplicates
from kpi.utils.query_parser import parse
from kpi.utils.sluggify import sluggify, sluggify_label
from kpi.utils.strings import split_lines_to_list
from kpi.utils.urls import versioned_reverse
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    get_or_create_element,
    strip_nodes,
    xml_tostring,
)
from kpi.versioning import APIV2Versioning


class ConvertHierarchicalKeysToNestedDictTestCase(TestCase):

    def test_regular_group(self):
        dict_ = {
            'group_lx4sf58/question_1': 'answer_1',
            'group_lx4sf58/question_2': 'answer_2',
        }

        expected = {
            'group_lx4sf58': {'question_1': 'answer_1', 'question_2': 'answer_2'}
        }

        assert convert_hierarchical_keys_to_nested_dict(dict_) == expected

    def test_nested_groups(self):
        dict_ = {'parent_group/middle_group/inner_group/question_1': 'answer_1'}

        expected = {
            'parent_group': {
                'middle_group': {'inner_group': {'question_1': 'answer_1'}}
            }
        }

        assert convert_hierarchical_keys_to_nested_dict(dict_) == expected

    def test_nested_repeated_groups(self):
        dict_ = {
            'formhub/uuid': '61b5029a4d2e42b49a12b9a18c22449f',
            'group_lq3wx73': [
                {
                    'group_lq3wx73/middle_group': [
                        {
                            'group_lq3wx73/middle_group/middle_q': 'middle 1.1.1.1',
                            'group_lq3wx73/middle_group/inner_group': [
                                {
                                    'group_lq3wx73/middle_group/inner_group/inner_q':
                                        'inner 1.1.1.1'
                                },
                                {
                                    'group_lq3wx73/middle_group/inner_group/inner_q':
                                        'inner 1.1.1.2'
                                },
                            ],
                        },
                        {
                            'group_lq3wx73/middle_group/middle_q': 'middle 1.1.2.1',
                            'group_lq3wx73/middle_group/inner_group': [
                                {
                                    'group_lq3wx73/middle_group/inner_group/inner_q':
                                        'inner 1.1.2.1'
                                },
                                {
                                    'group_lq3wx73/middle_group/inner_group/inner_q':
                                        'inner 1.1.2.1'
                                },
                            ],
                        },
                    ]
                },
                {
                    'group_lq3wx73/middle_group': [
                        {
                            'group_lq3wx73/middle_group/middle_q': 'middle 1.2.1.1',
                            'group_lq3wx73/middle_group/inner_group': [
                                {
                                    'group_lq3wx73/middle_group/inner_group/inner_q':
                                        'inner_q 1.2.1.1'
                                }
                            ],
                        }
                    ]
                },
            ],
        }

        expected = {
            'formhub': {'uuid': '61b5029a4d2e42b49a12b9a18c22449f'},
            'group_lq3wx73': [
                {
                    'middle_group': [
                        {
                            'middle_q': 'middle 1.1.1.1',
                            'inner_group': [
                                {'inner_q': 'inner 1.1.1.1'},
                                {'inner_q': 'inner 1.1.1.2'},
                            ],
                        },
                        {
                            'middle_q': 'middle 1.1.2.1',
                            'inner_group': [
                                {'inner_q': 'inner 1.1.2.1'},
                                {'inner_q': 'inner 1.1.2.1'},
                            ],
                        },
                    ]
                },
                {
                    'middle_group': [
                        {
                            'middle_q': 'middle 1.2.1.1',
                            'inner_group': [{'inner_q': 'inner_q 1.2.1.1'}],
                        }
                    ]
                },
            ],
        }
        assert convert_hierarchical_keys_to_nested_dict(dict_) == expected

    def test_nested_repeated_groups_in_group(self):
        dict_ = {
            'people/person': [
                {
                    'people/person/name': 'Julius Caesar',
                    'people/person/age': 55,
                },
                {
                    'people/person/name': 'Augustus',
                    'people/person/age': 75,
                },
            ],
        }

        expected = {
            'people': {
                'person': [
                    {'name': 'Julius Caesar', 'age': 55},
                    {'name': 'Augustus', 'age': 75},
                ]
            }
        }
        assert convert_hierarchical_keys_to_nested_dict(dict_) == expected


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
            [['asdf jkl'], 'asdf_jkl'],
            [['asdf', ['asdf']], 'asdf_001'],
            [['2. asdf'], '_2_asdf'],
            [['2. asdf', ['_2_asdf']], '_2_asdf_001'],
            [['asdf#123'], 'asdf_123'],
            [[' hello '], 'hello'],
            # FIX THIS when we come up with a better way to summarize
            # arabic and cyrillic text
            [['أين السوق؟', ['_', '__001']], '__002'],
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

    def test_autovalue_choices_with_different_name_and_label(self):
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
        query_string = """
            (a:a OR b:b AND c:can't) AND d:do"you"say OR (
                snakes:🐍🐍 AND NOT alphabet:🍲soup
            ) NOT 'in a house' NOT "with a mouse"
        """

        default_field_lookups = [
            'field_a__icontains',
            'field_b'
        ]

        expected_q = (
            (Q(a='a') | Q(b='b') & Q(c="can't")) & Q(d='do"you"say') | (
                Q(snakes='🐍🐍') & ~Q(alphabet='🍲soup')
            )
            & ~(
                Q(field_a__icontains='in a house') |
                Q(field_b='in a house')
            )
            & ~(
                Q(field_a__icontains='with a mouse') |
                Q(field_b='with a mouse')
            )
        )
        assert expected_q == parse(query_string, default_field_lookups)

    def test_query_parser_no_specified_field(self):
        query_string = 'foo'
        default_field_lookups = [
            'field_a__icontains',
            'field_b'
        ]
        expected_q = (
            Q(field_a__icontains='foo') |
            Q(field_b='foo')
        )
        assert repr(expected_q) == repr(
            parse(query_string, default_field_lookups)
        )

    def test_query_parser_with_lists_in_json_field(self):

        # List of dicts
        query_string = 'field__property[]__key:value'
        expected_q = Q(field__property__contains=[{'key': 'value'}])

        assert expected_q == parse(query_string, [])

        # List of strings
        query_string = 'field__property[]:value'
        expected_q = Q(field__property=['value'])
        assert expected_q == parse(query_string, [])

    def test_query_parser_with_empty_lists_in_json_field(self):

        query_string = 'field__property[]:""'
        expected_q = Q(field__property=[])
        assert expected_q == parse(query_string, [])

    def test_query_parser_not_supported_lookup_with_empty_lists_in_json_field(self):

        query_string = 'field__property[]__key__icontains:value'
        with pytest.raises(QueryParserNotSupportedFieldLookup):
            parse(query_string, [])

    def test_query_parser_default_search_too_short(self):
        # if the search query without a field is less than a specified
        # length of characters (currently 3), then it should
        # throw `SearchQueryTooShortException()` from `query_parser.py`
        default_field_lookups = [
            'field_a__icontains',
            'field_b'
        ]
        query_string = 'fo'
        with self.assertRaises(SearchQueryTooShortException) as e:
            parse(query_string, default_field_lookups)
        assert 'Your query is too short' in str(e.exception)

    def test_query_parser_short_and_long_terms(self):
        """
        As long as at least *one* term is long enough, or one term explicitly
        specifies a field, a search should succeed. See
        https://github.com/kobotoolbox/kpi/issues/3483
        """
        # should succeed due to long-enough terms
        parse('my great project', ['some_field'])
        # should suceeed due to explicit field specification
        parse('some_field:hi', ['some_field'])
        with self.assertRaises(SearchQueryTooShortException) as e:
            # should fail, all terms are short
            parse('me oh my', ['some_field'])

    def test_allow_choice_duplicates(self):
        surv = {
            'survey': [
                {'type': 'select_multiple',
                 'select_from_list_name': 'xxx'},
            ],
            'choices': [
                {'list_name': 'xxx', 'label': 'ABC', 'name': 'ABC'},
                {'list_name': 'xxx', 'label': 'Also ABC', 'name': 'ABC'},
            ],
            'settings': {},
        }

        # default should be 'yes'
        allow_choice_duplicates(surv)
        assert (
            surv['settings']['allow_choice_duplicates']
            == 'yes'
        )

        # 'no' should not be overwritten
        surv['settings']['allow_choice_duplicates'] = 'no'
        allow_choice_duplicates(surv)
        assert (
            surv['settings']['allow_choice_duplicates']
            == 'no'
        )

    def test_split_lines_to_list(self):

        value = '\r\nfoo\r\nbar\n\n'
        expected = ['foo', 'bar']
        assert split_lines_to_list(value) == expected

    @override_settings(KOBOFORM_URL='http://testserver')
    def test_versioned_reverse_with_no_request(self):
        # Default behavior: uses default namespace (api_v2)
        expected = 'http://testserver/api/v2/assets/foo/'
        got = versioned_reverse('asset-detail', kwargs={'uid_asset': 'foo'})
        assert got == expected

        # Same result when using args instead of kwargs
        got = versioned_reverse('asset-detail', args=('foo',))
        assert got == expected

        # Explicit v2 namespace should match the default behaviour
        got = versioned_reverse(
            'asset-detail',
            url_namespace=API_NAMESPACES['v2'],
            kwargs={'uid_asset': 'foo'},
        )
        assert got == expected

        # Explicit v1 namespace should produce a v1-style URL
        expected = 'http://testserver/assets/foo/'
        got = versioned_reverse(
            'asset-detail',
            url_namespace=API_NAMESPACES['v1'],
            kwargs={'uid_asset': 'foo'},
        )
        assert got == expected

        # Same result using args instead of kwargs for v1
        got = versioned_reverse(
            'asset-detail', url_namespace=API_NAMESPACES['v1'], args=('foo',)
        )
        assert got == expected

    @override_settings(KOBOFORM_URL='http://testserver')
    def test_versioned_reverse_with_request(self):

        # With request + versioning_scheme: uses API v2
        expected = 'http://testserver/api/v2/assets/foo/'
        request_factory = RequestFactory()
        request = request_factory.get(expected)
        request.versioning_scheme = APIV2Versioning()
        request.version = API_NAMESPACES['v2']

        # Uses versioned namespace when kwargs are passed
        got = versioned_reverse(
            'asset-detail', kwargs={'uid_asset': 'foo'}, request=request
        )
        assert got == expected

        # Same behaviour when passing args instead of kwargs
        got = versioned_reverse('asset-detail', args=('foo',), request=request)
        assert got == expected

        # Explicit v1 namespace should override request version
        expected = 'http://testserver/assets/foo/'
        got = versioned_reverse(
            'asset-detail',
            url_namespace=API_NAMESPACES['v1'],
            args=('foo',),
            request=request,
        )
        assert got == expected

        # No versioning_scheme → should fall back to default (v2)
        expected = 'http://testserver/api/v2/assets/foo/'
        request_factory = RequestFactory()
        request = request_factory.get(expected)
        got = versioned_reverse(
            'asset-detail', kwargs={'uid_asset': 'foo'}, request=request
        )
        assert got == expected

        # Same fallback behaviour with args instead of kwargs
        got = versioned_reverse('asset-detail', args=('foo',), request=request)
        assert got == expected


class XmlUtilsTestCase(TestCase):

    def setUp(self):
        super().setUp()
        fixtures_dir = os.path.join(settings.BASE_DIR,
                                    'kpi', 'fixtures')
        self.__submission_xml_file = open(
            os.path.join(fixtures_dir, 'submission.xml')
        )
        self.__submission = self.__submission_xml_file.read()

    def tearDown(self) -> None:
        self.__submission_xml_file.close()
        super().tearDown()

    def test_strip_xml_nodes_and_rename_root_node(self):
        source = '<abcdef><a><b><c>abcdef</c></b></a></abcdef>'
        expected = '<root><a><b><c>abcdef</c></b></a></root>'
        result = strip_nodes(
            source=source,
            nodes_to_keep=['a', 'b', 'c'],
            rename_root_node_to='root',
        )
        self.__compare_xml(result, expected)

    def test_strip_xml_nodes_by_fields(self):
        expected = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '        </subgroup1>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['question_1', 'question_5']),
            expected,
        )

        expected = (
            '<root>'
            '    <group1>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['question_5']),
            expected,
        )

    def test_strip_xml_nodes_by_fields_similar_names(self):
        expected_subgroup = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '            <question_2>Answer 2</question_2>'
            '        </subgroup1>'
            '    </group1>'
            '</root>'
        )
        expected_group = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '            <question_2>Answer 2</question_2>'
            '        </subgroup1>'
            '        <subgroup11>'
            '            <question_3>Answer 3</question_3>'
            '            <question_4>Answer 4</question_4>'
            '        </subgroup11>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['subgroup1']),
            expected_subgroup,
        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['group1']),
            expected_group,
        )

    def test_strip_xml_nodes_by_xpaths(self):
        expected = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '        </subgroup1>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )
        self.__compare_xml(
            strip_nodes(
                self.__submission,
                ['group1/subgroup1/question_1', 'group1/question_5'],
                use_xpath=True,
            ),
            expected,
        )

    def test_strip_xml_nodes_by_xpaths_similar_names(self):
        expected_subgroup = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '            <question_2>Answer 2</question_2>'
            '        </subgroup1>'
            '    </group1>'
            '</root>'
        )
        expected_group = (
            '<root>'
            '    <group1>'
            '        <subgroup1>'
            '            <question_1>Answer 1</question_1>'
            '            <question_2>Answer 2</question_2>'
            '        </subgroup1>'
            '        <subgroup11>'
            '            <question_3>Answer 3</question_3>'
            '            <question_4>Answer 4</question_4>'
            '        </subgroup11>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['group1/subgroup1'], use_xpath=True),
            expected_subgroup,

        )
        self.__compare_xml(
            strip_nodes(self.__submission, ['group1'], use_xpath=True),
            expected_group,
        )

    def test_strip_xml_nodes_by_xpaths_with_slashes(self):
        expected = (
            '<root>'
            '    <group1>'
            '        <question_5>Answer 5</question_5>'
            '    </group1>'
            '</root>'
        )

        # With trailing slash
        self.__compare_xml(
            strip_nodes(self.__submission, ['group1/question_5/'],
                        use_xpath=True),
            expected,

        )

        # With leading slash
        self.__compare_xml(
            strip_nodes(self.__submission, ['/group1/question_5'],
                        use_xpath=True),
            expected,

        )

        # With both
        self.__compare_xml(
            strip_nodes(self.__submission, ['/group1/question_5/'],
                        use_xpath=True),
            expected,

        )

    def test_get_or_create_element(self):
        initial_xml_with_ns = """
            <hello xmlns="http://opendatakit.org/submissions">
                <meta>
                    <instanceID>uuid:abc-123</instanceID>
                </meta>
            </hello>
        """
        expected_xml_with_ns_after_modification = """
            <hello xmlns="http://opendatakit.org/submissions">
                <meta>
                    <instanceID>uuid:def-456</instanceID>
                    <deprecatedID>uuid:abc-123</deprecatedID>
                </meta>
            </hello>
        """

        initial_xml_without_ns = initial_xml_with_ns.replace(
            ' xmlns="http://opendatakit.org/submissions"', ''
        )
        expected_xml_without_ns_after_modification = (
            expected_xml_with_ns_after_modification.replace(
                ' xmlns="http://opendatakit.org/submissions"', ''
            )
        )

        for initial, expected in (
            (initial_xml_with_ns, expected_xml_with_ns_after_modification),
            (
                initial_xml_without_ns,
                expected_xml_without_ns_after_modification,
            ),
        ):
            root = fromstring_preserve_root_xmlns(initial)
            assert root.tag == 'hello'

            initial_e = get_or_create_element(root, 'meta/instanceID')
            assert (
                initial_e.text == 'uuid:abc-123'
            )
            initial_e.text = 'uuid:def-456'

            new_e = get_or_create_element(root, 'meta/deprecatedID')
            assert new_e.tag == 'deprecatedID'
            assert new_e.text is None
            new_e.text = 'uuid:abc-123'

            self.__compare_xml(
                xml_tostring(root),
                expected,
            )

    def test_edit_submission_xml(self):
        xml_parsed = fromstring_preserve_root_xmlns(self.__submission)
        update_data = {
            'group1/subgroup1/question_1': 'Edit 1',
            'group1/subgroup11/question_3': 'Edit 2',
            'group11/question_66': 'Edit 3',
            'group11/question_666': 'Answer 666',
            'group111/subgroup111/subsubgroup1/question_7': 'Answer 7',
            'question8': 'Answer 8',
            'a/b/c/d/e/f/g/h/i': 'Alphabet soup',
        }
        for k, v in update_data.items():
            edit_submission_xml(xml_parsed, k, v)
        xml_expected = """
            <root>
                <group1>
                    <subgroup1>
                        <question_1>Edit 1</question_1>
                        <question_2>Answer 2</question_2>
                    </subgroup1>
                    <subgroup11>
                        <question_3>Edit 2</question_3>
                        <question_4>Answer 4</question_4>
                    </subgroup11>
                    <question_5>Answer 5</question_5>
                </group1>
                <group11>
                    <question_6>Answer 6</question_6>
                    <question_66>Edit 3</question_66>
                    <question_666>Answer 666</question_666>
                </group11>
                <group111>
                    <subgroup111>
                        <subsubgroup1>
                            <question_7>Answer 7</question_7>
                        </subsubgroup1>
                    </subgroup111>
                </group111>
                <question8>Answer 8</question8>
                <a>
                    <b>
                        <c>
                            <d>
                                <e>
                                    <f>
                                        <g>
                                            <h>
                                                <i>Alphabet soup</i>
                                            </h>
                                        </g>
                                    </f>
                                </e>
                            </d>
                        </c>
                    </b>
                </a>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), xml_expected)

    def test_edit_submission_xml_repeat_group(self):
        """Test editing repeat groups in XML"""
        initial_xml = """
            <root>
                <group1>
                    <repeat_group>
                        <field1>old1</field1>
                        <field2>old2</field2>
                    </repeat_group>
                    <repeat_group>
                        <field1>old3</field1>
                        <field2>old4</field2>
                    </repeat_group>
                </group1>
            </root>
        """
        xml_parsed = fromstring_preserve_root_xmlns(initial_xml)

        update_data = [
            {
                'group1/repeat_group/field1': 'new1',
                'group1/repeat_group/field2': 'new2',
            },
            {
                'group1/repeat_group/field1': 'new3',
                'group1/repeat_group/field2': 'new4',
            },
            {
                'group1/repeat_group/field1': 'new5',
                'group1/repeat_group/field2': 'new6',
            },
        ]

        edit_submission_xml(xml_parsed, 'group1/repeat_group', update_data)

        expected_xml = """
            <root>
                <group1>
                    <repeat_group>
                        <field1>new1</field1>
                        <field2>new2</field2>
                    </repeat_group>
                    <repeat_group>
                        <field1>new3</field1>
                        <field2>new4</field2>
                    </repeat_group>
                    <repeat_group>
                        <field1>new5</field1>
                        <field2>new6</field2>
                    </repeat_group>
                </group1>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), expected_xml)

    def test_edit_submission_xml_repeat_group_create_new(self):
        """Test creating repeat groups where none existed before"""
        initial_xml = """
            <root>
                <other_field>value</other_field>
            </root>
        """
        xml_parsed = fromstring_preserve_root_xmlns(initial_xml)

        update_data = [
            {
                'parent/repeat_group/field1': 'value1',
                'parent/repeat_group/field2': 'value2',
            },
            {
                'parent/repeat_group/field1': 'value3',
                'parent/repeat_group/field2': 'value4',
            },
        ]

        edit_submission_xml(xml_parsed, 'parent/repeat_group', update_data)

        expected_xml = """
            <root>
                <other_field>value</other_field>
                <parent>
                    <repeat_group>
                        <field1>value1</field1>
                        <field2>value2</field2>
                    </repeat_group>
                    <repeat_group>
                        <field1>value3</field1>
                        <field2>value4</field2>
                    </repeat_group>
                </parent>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), expected_xml)

    def test_edit_submission_xml_repeat_group_empty_list(self):
        """Test removing repeat groups with empty list"""
        initial_xml = """
            <root>
                <group1>
                    <repeat_group>
                        <field1>old1</field1>
                    </repeat_group>
                    <repeat_group>
                        <field1>old2</field1>
                    </repeat_group>
                </group1>
            </root>
        """
        xml_parsed = fromstring_preserve_root_xmlns(initial_xml)

        edit_submission_xml(xml_parsed, 'group1/repeat_group', [])

        expected_xml = """
            <root>
                <group1>
                </group1>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), expected_xml)

    def test_edit_submission_xml_mixed_update(self):
        """Test updating both simple fields and repeat groups"""
        initial_xml = """
            <root>
                <simple_field>old_value</simple_field>
                <group1>
                    <repeat_group>
                        <field1>old1</field1>
                    </repeat_group>
                </group1>
            </root>
        """
        xml_parsed = fromstring_preserve_root_xmlns(initial_xml)

        # Update simple field
        edit_submission_xml(xml_parsed, 'simple_field', 'new_value')

        # Update repeat group
        repeat_data = [
            {'group1/repeat_group/field1': 'new1'},
            {'group1/repeat_group/field1': 'new2'},
        ]
        edit_submission_xml(xml_parsed, 'group1/repeat_group', repeat_data)

        expected_xml = """
            <root>
                <simple_field>new_value</simple_field>
                <group1>
                    <repeat_group>
                        <field1>new1</field1>
                    </repeat_group>
                    <repeat_group>
                        <field1>new2</field1>
                    </repeat_group>
                </group1>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), expected_xml)

    def test_edit_submission_xml_nested_repeat_groups(self):
        """Test editing nested repeat groups"""
        initial_xml = """
            <root>
                <outer_repeat>
                    <outer_field>old_outer</outer_field>
                </outer_repeat>
            </root>
        """
        xml_parsed = fromstring_preserve_root_xmlns(initial_xml)

        update_data = [
            {
                'outer_repeat/outer_field': 'outer1',
                'outer_repeat/inner_repeat': [
                    {'outer_repeat/inner_repeat/inner_field': 'inner1.1'},
                    {'outer_repeat/inner_repeat/inner_field': 'inner1.2'},
                ],
            },
            {
                'outer_repeat/outer_field': 'outer2',
                'outer_repeat/inner_repeat': [
                    {'outer_repeat/inner_repeat/inner_field': 'inner2.1'},
                ],
            },
        ]

        edit_submission_xml(xml_parsed, 'outer_repeat', update_data)

        expected_xml = """
            <root>
                <outer_repeat>
                    <outer_field>outer1</outer_field>
                    <inner_repeat>
                        <inner_field>inner1.1</inner_field>
                    </inner_repeat>
                    <inner_repeat>
                        <inner_field>inner1.2</inner_field>
                    </inner_repeat>
                </outer_repeat>
                <outer_repeat>
                    <outer_field>outer2</outer_field>
                    <inner_repeat>
                        <inner_field>inner2.1</inner_field>
                    </inner_repeat>
                </outer_repeat>
            </root>
        """
        self.__compare_xml(xml_tostring(xml_parsed), expected_xml)

    def __compare_xml(self, source: str, target: str) -> bool:
        """ Attempts to standardize XML by removing whitespace between tags """
        pattern = r'\s*(<[^>]+>)\s*'
        re_source = re.sub(pattern, r'\1', source)
        re_target = re.sub(pattern, r'\1', target)
        self.assertEqual(re_source, re_target)
