from unittest.mock import patch

from django.db import connection, models
from django.db.models.expressions import RawSQL
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from model_bakery import baker
from rest_framework import generics, serializers
from rest_framework.test import APIRequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import LIMITED_COUNT_MANY, LIMITED_COUNT_UNKNOWN
from kpi.paginators import DefaultPagination, LimitedCountPagination, NoCountPagination


class PassThroughSerializer(serializers.BaseSerializer):
    def to_representation(self, item):
        return item


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

    @override_settings(LIMITED_COUNT_MAX_ROWS=100)
    def test_below_cap_returns_exact_int(self):
        self._make_users(5)
        paginator = LimitedCountPagination()
        assert paginator.get_count(self._queryset()) == 5

    @override_settings(LIMITED_COUNT_MAX_ROWS=5)
    def test_exactly_at_cap_returns_exact_int(self):
        self._make_users(5)
        paginator = LimitedCountPagination()
        count = paginator.get_count(self._queryset())
        assert count == 5
        assert count != LIMITED_COUNT_MANY

    @override_settings(LIMITED_COUNT_MAX_ROWS=5)
    def test_above_cap_returns_many(self):
        self._make_users(6)
        paginator = LimitedCountPagination()
        assert paginator.get_count(self._queryset()) == LIMITED_COUNT_MANY

    @override_settings(LIMITED_COUNT_MAX_ROWS=5)
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

    @override_settings(LIMITED_COUNT_TIMEOUT_MS=1, LIMITED_COUNT_MAX_ROWS=1_000_000)
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

    @override_settings(LIMITED_COUNT_TIMEOUT_MS=0, LIMITED_COUNT_MAX_ROWS=1_000_000)
    def test_timeout_disabled_issues_count_only(self):
        self._make_users(2)
        paginator = LimitedCountPagination()
        with CaptureQueriesContext(connection) as ctx:
            assert paginator.get_count(self._queryset()) == 2
        # Exactly the capped count: no savepoint, and never `set_config`, which
        # would override (and with 0, disable) the connection-wide timeout
        assert len(ctx.captured_queries) == 1
        assert 'set_config' not in ctx.captured_queries[0]['sql']

    @override_settings(LIMITED_COUNT_TIMEOUT_MS=5000, LIMITED_COUNT_MAX_ROWS=1_000_000)
    def test_timeout_enabled_but_fast_returns_exact_int(self):
        self._make_users(3)
        paginator = LimitedCountPagination()
        with CaptureQueriesContext(connection) as ctx:
            assert paginator.get_count(self._queryset()) == 3
        assert any('set_config' in q['sql'] for q in ctx.captured_queries)

    @override_settings(LIMITED_COUNT_MAX_ROWS=10)
    def test_plain_sequence(self):
        paginator = LimitedCountPagination()
        assert paginator.get_count(range(10)) == 10
        assert paginator.get_count(range(11)) == LIMITED_COUNT_MANY
        assert paginator.get_count(list(range(3))) == 3

    @override_settings(LIMITED_COUNT_MAX_ROWS=1_000_000)
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

    @override_settings(LIMITED_COUNT_MAX_ROWS=1_000_000)
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

    def _make_users(self, count):
        for i in range(count):
            baker.make(User, username=f'lcp_{i}')

    def _queryset(self):
        return User.objects.filter(username__startswith='lcp_')
