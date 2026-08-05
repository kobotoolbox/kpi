import pytest
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import QueryParserNotSupportedFieldLookup
from kpi.models.asset import Asset
from kpi.utils.query_parser import split_relational_and
from kpi.utils.query_parser.query_parser import QueryParseActions, parse


class TestQueryParseActionsProcessValue(TestCase):
    def setUp(self):
        self.query_parse_actions = QueryParseActions([], 3)

    def test_boolean_values(self):
        # Test various boolean inputs
        test_cases = [
            ('true', True),
            ('True', True),
            (True, True),
            ('false', False),
            ('FALSE', False),
            (False, False),
        ]

        for input_value, expected in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, expected)
                self.assertIsInstance(result, bool)

    def test_numeric_values(self):
        # Test integer values
        test_cases = [
            ('42', 42),
            (42, 42),
            ('-17', -17),
            # Test float values
            ('3.14', 3.14),
            (3.14, 3.14),
            ('-2.5', -2.5),
        ]

        for input_value, expected in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, expected)
                self.assertIsInstance(result, type(expected))

    def test_string_values(self):
        # Test string values
        test_cases = [
            'hello',
            'Hello World',
            '123abc',
            'special!@#$',
        ]

        for input_value in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, input_value)
                self.assertIsInstance(result, str)

    def test_null_value(self):
        # Test null value
        result = self.query_parse_actions.process_value('field', 'null')
        self.assertIsNone(result)


# Field-qualified `q` terms whose lookup path reaches a sensitive model (or
# column) must be rejected, whatever the root model and relation chain used.
BLOCKED_QUERIES = [
    (Asset, 'owner__auth_token__key__startswith:abcdef'),
    (Asset, 'owner__password:somehash'),
    (Asset, 'owner__mfa_methods_wrapper__secret:x'),
    (Asset, 'owner__authenticator__data:x'),
    (Asset, 'owner__partialdigest__partial_digest:x'),
    (Asset, 'owner__socialaccount__socialtoken__token:x'),
    (Asset, 'owner__emailaddress__emailconfirmation__key:x'),
    (Asset, 'parent__owner__auth_token__key:x'),  # multi-hop, different prefix
    (User, 'auth_token__key:x'),  # direct lookup, no `owner__`/`user__` prefix
    (User, 'password:x'),
    (User, 'authenticator__data:x'),
    # sensitive column on a model that stays searchable for its other columns;
    # blocked even with a trailing lookup, since the walk stops at the column
    (User, 'extra_details__private_data__last_tos_accept_time:x'),
    (Asset, 'owner__extra_details__private_data__icontains:x'),

    # NEW ALLOWLIST TESTS:
    # Prove default-deny works for innocent but un-whitelisted real fields:
    # User.first_name and User.last_name exist but are not explicitly whitelisted.
    (Asset, 'owner__first_name:x'),
    (Asset, 'owner__last_name:x'),
    (Asset, 'owner__email:meg@example.com'),
    (Asset, 'owner__is_superuser:True'),
    # Only `name`/`slug`/`website` are allowed on `Organization`; the walk must
    # not hop from `Organization` onto its own relations (e.g. its owner).
    (Asset, 'owner__organizations_organization__owner__username:x'),
]

# Legitimate field-qualified terms that must keep working.
ALLOWED_QUERIES = [
    (Asset, 'owner__username:meg'),
    (Asset, 'parent__uid:aTJ3vi2KRGYj'),
    (Asset, 'parent:null'),
    (Asset, 'settings__sector__iexact:health'),
    (Asset, 'settings__description__icontains:water'),
    (Asset, 'tags__name__icontains:health'),
    (Asset, 'date_created__gte:2022-11-15'),
    (Asset, 'asset_type:survey'),
    (Asset, 'uid__in:abc'),
    (User, 'username:foo'),
    (User, 'extra_details__data__name:foo'),
    (Asset, 'search_field__owner_username__icontains:foo'),
    (Asset, 'search_field__organization_name__icontains:bar'),
    # Live organization name via the real `Organization` table, reached through
    # `owner` -> user -> `organizations_organization` -> `name`.
    (Asset, 'owner__organizations_organization__name__icontains:acme'),
]


@pytest.mark.parametrize('model, query', BLOCKED_QUERIES)
def test_secret_lookup_paths_are_rejected(model, query):
    with pytest.raises(QueryParserNotSupportedFieldLookup):
        parse(query, default_field_lookups=['name__icontains'], model=model)


@pytest.mark.parametrize('model, query', ALLOWED_QUERIES)
def test_legitimate_lookup_paths_are_allowed(model, query):
    # Should build a `Q` object without raising
    assert (
        parse(query, default_field_lookups=['name__icontains'], model=model)
        is not None
    )


def test_parse_requires_a_model():
    # `model` is mandatory: forgetting it must fail loudly at the call site
    # rather than silently skipping the lookup validation
    with pytest.raises(TypeError):
        parse('owner__username:meg', default_field_lookups=['name__icontains'])


def test_field_term_without_model_is_rejected():
    # Without a model the lookup cannot be proven safe, so it is rejected
    # (fail-closed) instead of allowed
    actions = QueryParseActions(['name__icontains'], 3, model=None)
    with pytest.raises(QueryParserNotSupportedFieldLookup):
        actions._validate_field('owner__username')


def test_superuser_bypass():
    """
    Superusers should bypass the allowlist checks and be permitted to query
    paths that would otherwise be blocked.
    """
    class MockSuperUser:
        is_superuser = True

    # User.password is highly sensitive and normally blocked.
    query = 'owner__password:x'

    # 1. Without superuser, it should raise an exception (verify normal behavior)
    with pytest.raises(QueryParserNotSupportedFieldLookup):
        parse(query, default_field_lookups=['name__icontains'], model=Asset, user=None)

    # 2. With superuser, it should parse without raising any exceptions
    parsed_q = parse(
        query,
        default_field_lookups=['name__icontains'],
        model=Asset, user=MockSuperUser(),
    )
    assert parsed_q is not None


def test_viewset_level_allowlist_overrides():
    """
    Test that providing `allowed_lookup_fields` to `parse()` allows augmenting
    the default allowlist on a per-viewset basis.
    """
    query = 'owner__first_name:foo'

    # 1. By default, 'first_name' on 'kobo_auth.user' is not allowed
    with pytest.raises(QueryParserNotSupportedFieldLookup):
        parse(query, default_field_lookups=['name__icontains'], model=Asset, user=None)

    # 2. When 'kobo_auth.user' is augmented with 'first_name', the query parses
    # successfully
    parsed_q = parse(
        query,
        default_field_lookups=['name__icontains'],
        model=Asset,
        allowed_lookup_fields={'kobo_auth.user': {'first_name'}},
        user=None
    )
    assert parsed_q is not None


def _parse(query):
    return parse(query, default_field_lookups=['name__icontains'], model=Asset)


class TestSplitRelationalAnd(TestCase):
    """
    `split_relational_and` pulls to-many leaves out of a top-level AND so the
    filter backend can apply them as chained `.filter()` calls (DEV-1581).
    """

    def test_multiple_tags_are_chained(self):
        # `tags` is a many-to-many: each tag must be a separate filter
        main, chained = split_relational_and(
            _parse('tags__name:foo AND tags__name:bar'), Asset
        )
        self.assertEqual(len(chained), 2)
        # nothing scalar left, so `main` matches everything
        self.assertEqual(len(main.children), 0)

    def test_scalar_and_stays_merged(self):
        main, chained = split_relational_and(
            _parse('asset_type:survey AND name__icontains:x'), Asset
        )
        self.assertEqual(chained, [])
        self.assertEqual(len(main.children), 2)

    def test_mixed_scalar_and_relational(self):
        main, chained = split_relational_and(
            _parse('asset_type:survey AND tags__name:foo AND tags__name:bar'),
            Asset,
        )
        self.assertEqual(len(chained), 2)
        # only the scalar `asset_type` stays in the merged Q
        self.assertEqual(len(main.children), 1)

    def test_to_one_relation_not_chained(self):
        # `owner` is a to-one FK: merging is correct, no chaining
        main, chained = split_relational_and(
            _parse('owner__username:a AND owner__username:b'), Asset
        )
        self.assertEqual(chained, [])
        self.assertEqual(len(main.children), 2)

    def test_single_tag_is_chained_alone(self):
        main, chained = split_relational_and(_parse('tags__name:foo'), Asset)
        self.assertEqual(len(chained), 1)
        self.assertEqual(len(main.children), 0)

    def test_or_root_falls_back(self):
        q = _parse('tags__name:foo OR tags__name:bar')
        main, chained = split_relational_and(q, Asset)
        self.assertEqual(chained, [])
        self.assertIs(main, q)

    def test_negated_root_falls_back(self):
        q = _parse('NOT (tags__name:foo AND tags__name:bar)')
        main, chained = split_relational_and(q, Asset)
        self.assertEqual(chained, [])
        self.assertIs(main, q)

    def test_none_model_falls_back(self):
        # Without a model, to-many detection cannot run: leave the Q untouched
        q = _parse('tags__name:foo AND tags__name:bar')
        main, chained = split_relational_and(q, None)
        self.assertEqual(chained, [])
        self.assertIs(main, q)
