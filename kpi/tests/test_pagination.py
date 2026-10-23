from types import SimpleNamespace
from unittest.mock import patch

from django.db import OperationalError, connection, models
from django.db.models import Count
from django.db.models.expressions import RawSQL
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from model_bakery import baker
from rest_framework import generics, serializers
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import LIMITED_COUNT_MANY, LIMITED_COUNT_UNKNOWN
from kpi.paginators import (
    DataPagination,
    DefaultPagination,
    LimitedCountPagination,
    NoCountPagination,
)


class PassThroughSerializer(serializers.BaseSerializer):
    def to_representation(self, item):
        return item


class TestDataPagination(TestCase):

    def test_paginate_queryset_peeks_one_row_past_the_page(self):
        """
        Test that the extra row fetched past the page sets `next` without being
        returned, and that the count comes from the view's deployment
        """
        deployment = SimpleNamespace(current_submission_count=LIMITED_COUNT_MANY)
        view = SimpleNamespace(asset=SimpleNamespace(deployment=deployment))
        request = Request(APIRequestFactory().get('/', {'start': 4, 'limit': 2}))
        paginator = DataPagination()

        page = paginator.paginate_queryset(
            iter([{'_id': 5}, {'_id': 6}, {'_id': 7}]), request, view
        )

        assert page == [{'_id': 5}, {'_id': 6}]
        assert paginator.count == LIMITED_COUNT_MANY
        assert 'start=6' in paginator.get_next_link()

        page = paginator.paginate_queryset(iter([{'_id': 5}]), request, view)

        assert page == [{'_id': 5}]
        assert paginator.get_next_link() is None


class TestDefaultPagination(TestCase):
    def setUp(self):
        self.request_factory = APIRequestFactory()
        self.queryset_len = DefaultPagination.default_limit * 3

    def test_with_start_offset(self):
        self.view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=range(1, self.queryset_len),
            pagination_class=DefaultPagination,
        )
        request = self.request_factory.get('/', {'start': 20})
        response = self.view(request)
        assert response.data['results'][0:5] == [21, 22, 23, 24, 25]

        request = self.request_factory.get('/', {'offset': 30})
        response = self.view(request)
        assert response.data['results'][0:5] == [31, 32, 33, 34, 35]

    def test_pagination_with_page(self):
        self.view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=range(1, self.queryset_len),
            pagination_class=DefaultPagination,
        )
        request = self.request_factory.get('/', {'page': 2, 'page_size': 5})
        response = self.view(request)

        assert response.data['results'] == [6, 7, 8, 9, 10]


class TestNoCountPagination(TestCase):
    def setUp(self):
        self.request_factory = APIRequestFactory()

    def test_no_count(self):
        with patch.object(
            NoCountPagination, 'get_count', wraps=NoCountPagination.get_count
        ) as mock_get_count:
            self.view = generics.ListAPIView.as_view(
                serializer_class=PassThroughSerializer,
                queryset=range(1, NoCountPagination.default_limit * 3),
                pagination_class=NoCountPagination,
            )
            request = self.request_factory.get('/', {'start': 20})
            response = self.view(request)
            mock_get_count.assert_not_called()
            assert 'count' not in response.data
            assert len(response.data['results']) == NoCountPagination.default_limit

    def test_nocount_with_page_params(self):
        default_limit = NoCountPagination.default_limit
        data = list(range(1, default_limit * 3))
        self.view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=data,
            pagination_class=NoCountPagination,
        )
        request = self.request_factory.get('/', {'page': 2})
        response = self.view(request)

        assert 'count' not in response.data
        assert data[default_limit:(default_limit * 2)] == response.data['results']


class TestLimitedCountPagination(TestCase):
    """
    Exercise the capped count contract: an exact int up to the cap, 'many'
    past it, and 'unknown' when the scoped count query times out.
    """

    def setUp(self):
        self.request_factory = APIRequestFactory()

    @override_settings(API_LIMITED_COUNT_MAX=100)
    def test_below_cap_returns_exact_int(self):
        self._make_users(5)
        paginator = LimitedCountPagination()
        assert paginator.get_count(self._queryset()) == 5

    @override_settings(API_LIMITED_COUNT_MAX=5)
    def test_exactly_at_cap_returns_exact_int(self):
        self._make_users(5)
        paginator = LimitedCountPagination()
        count = paginator.get_count(self._queryset())
        assert count == 5
        assert count != LIMITED_COUNT_MANY

    @override_settings(API_LIMITED_COUNT_MAX=5)
    def test_above_cap_returns_many(self):
        self._make_users(6)
        paginator = LimitedCountPagination()
        assert paginator.get_count(self._queryset()) == LIMITED_COUNT_MANY

    @override_settings(API_LIMITED_COUNT_MAX=5)
    def test_above_cap_response_via_view(self):
        self._make_users(6)
        view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=self._queryset().order_by('pk'),
            pagination_class=LimitedCountPagination,
        )
        request = self.request_factory.get('/', {'limit': 2})
        response = view(request)
        assert response.data['count'] == LIMITED_COUNT_MANY
        assert len(response.data['results']) > 0
        assert response.data['next'] is not None
        assert response.data['previous'] is None

    @override_settings(API_LIMITED_COUNT_TIMEOUT=1, API_LIMITED_COUNT_MAX=1_000_000)
    def test_count_timeout_returns_unknown(self):
        self._make_users(3)
        # `pg_sleep(0) IS NULL` is false (void type), so `isnull=False` keeps
        # the rows and the per-row sleep runs while the count scans them
        queryset = (
            self._queryset()
            .annotate(
                slow=RawSQL('pg_sleep(0.5)', [], output_field=models.BooleanField())
            )
            .filter(slow__isnull=False)
        )
        paginator = LimitedCountPagination()
        assert paginator.get_count(queryset) == LIMITED_COUNT_UNKNOWN
        # The savepoint rollback reverts the scoped timeout and leaves the
        # connection usable for the next query
        assert User.objects.filter(username__startswith='lcp_').count() == 3

    @override_settings(API_LIMITED_COUNT_TIMEOUT=0, API_LIMITED_COUNT_MAX=1_000_000)
    def test_timeout_disabled_issues_count_only(self):
        self._make_users(2)
        paginator = LimitedCountPagination()
        with CaptureQueriesContext(connection) as ctx:
            assert paginator.get_count(self._queryset()) == 2
        # Exactly the capped count: no savepoint, and never `set_config`, which
        # would override (and with 0, disable) the connection-wide timeout
        assert len(ctx.captured_queries) == 1
        assert 'set_config' not in ctx.captured_queries[0]['sql']

    @override_settings(API_LIMITED_COUNT_TIMEOUT=5000, API_LIMITED_COUNT_MAX=1_000_000)
    def test_timeout_enabled_but_fast_returns_exact_int(self):
        self._make_users(3)
        paginator = LimitedCountPagination()
        with CaptureQueriesContext(connection) as ctx:
            assert paginator.get_count(self._queryset()) == 3
        assert any('set_config' in q['sql'] for q in ctx.captured_queries)

    @override_settings(API_LIMITED_COUNT_MAX=10)
    def test_plain_sequence(self):
        paginator = LimitedCountPagination()
        assert paginator.get_count(range(10)) == 10
        assert paginator.get_count(range(11)) == LIMITED_COUNT_MANY
        assert paginator.get_count(list(range(3))) == 3

    @override_settings(API_LIMITED_COUNT_MAX=1_000_000)
    def test_empty_queryset_via_view(self):
        view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=self._queryset().order_by('pk'),
            pagination_class=LimitedCountPagination,
        )
        request = self.request_factory.get('/')
        response = view(request)
        assert response.status_code == 200
        assert response.data['count'] == 0
        assert response.data['results'] == []
        assert response.data['next'] is None
        assert response.data['previous'] is None

    @override_settings(API_LIMITED_COUNT_MAX=1_000_000)
    def test_offset_beyond_count_via_view(self):
        self._make_users(3)
        view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=self._queryset().order_by('pk'),
            pagination_class=LimitedCountPagination,
        )
        request = self.request_factory.get('/', {'start': 50})
        response = view(request)
        assert response.status_code == 200
        assert response.data['count'] == 3
        assert response.data['results'] == []
        assert response.data['next'] is None

    @override_settings(API_LIMITED_COUNT_MAX=1_000_000)
    def test_offset_at_count_skips_page_query(self):
        self._make_users(3)
        paginator = LimitedCountPagination()
        request = Request(self.request_factory.get('/', {'start': 3}))
        with CaptureQueriesContext(connection) as ctx:
            assert paginator.paginate_queryset(self._queryset(), request) == []
        assert paginator.get_next_link() is None
        # The exact count already proves the page is empty: no page query
        assert len(ctx.captured_queries) == 1

    @override_settings(API_LIMITED_COUNT_MAX=100)
    def test_grouped_values_queryset_counts_groups(self):
        self._make_users(4)
        queryset = self._queryset().values('is_active').annotate(n=Count('pk'))
        paginator = LimitedCountPagination()
        assert paginator.get_count(queryset) == 1

    @override_settings(API_LIMITED_COUNT_MAX=1)
    def test_grouped_values_queryset_capped_by_groups_not_rows(self):
        # Three rows but one group: the cap applies to the groups listed
        self._make_users(3)
        queryset = self._queryset().values('is_active').annotate(n=Count('pk'))
        paginator = LimitedCountPagination()
        assert paginator.get_count(queryset) == 1

    def _make_users(self, count):
        for i in range(count):
            baker.make(User, username=f'lcp_{i}')

    def _queryset(self):
        return User.objects.filter(username__startswith='lcp_')


class TestLimitedCountPaginationTimeoutScope(TransactionTestCase):
    """
    The scoped timeout must not outlive the count, or it would cancel the
    page query that follows, and only it is reported as 'unknown'.

    Real transactions are needed (hence `TransactionTestCase`): inside
    `TestCase`'s wrapping transaction, `SET LOCAL` lasts until the test ends.
    """

    def setUp(self):
        # Connection-wide timeout, like `kobo/settings/prod.py`
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '30s'")
        self.addCleanup(self._reset_statement_timeout)
        for i in range(3):
            baker.make(User, username=f'lcp_{i}')
        self.queryset = User.objects.filter(username__startswith='lcp_')

    @override_settings(API_LIMITED_COUNT_TIMEOUT=0, API_LIMITED_COUNT_MAX=1_000_000)
    def test_connection_timeout_raises_when_scoped_timeout_disabled(self):
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '1ms'")
        paginator = LimitedCountPagination()
        with self.assertRaises(OperationalError):
            paginator.get_count(self._slow_queryset())

    @override_settings(API_LIMITED_COUNT_TIMEOUT=1, API_LIMITED_COUNT_MAX=1_000_000)
    def test_timeout_restored_after_canceled_count(self):
        paginator = LimitedCountPagination()
        assert paginator.get_count(self._slow_queryset()) == LIMITED_COUNT_UNKNOWN
        assert self._statement_timeout() == '30s'

    @override_settings(API_LIMITED_COUNT_TIMEOUT=5000, API_LIMITED_COUNT_MAX=1_000_000)
    def test_timeout_restored_after_count(self):
        paginator = LimitedCountPagination()
        assert paginator.get_count(self.queryset) == 3
        assert self._statement_timeout() == '30s'

    def _reset_statement_timeout(self):
        with connection.cursor() as cursor:
            cursor.execute('RESET statement_timeout')

    def _slow_queryset(self):
        return self.queryset.annotate(
            slow=RawSQL('pg_sleep(0.5)', [], output_field=models.BooleanField())
        ).filter(slow__isnull=False)

    def _statement_timeout(self) -> str:
        with connection.cursor() as cursor:
            cursor.execute('SHOW statement_timeout')
            return cursor.fetchone()[0]
