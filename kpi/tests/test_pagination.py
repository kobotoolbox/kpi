from unittest.mock import patch

from django.test import TestCase
from rest_framework import generics, serializers
from rest_framework.test import APIRequestFactory

from kpi.paginators import DefaultPagination, NoCountPagination


class PassThroughSerializer(serializers.BaseSerializer):
    def to_representation(self, item):
        return item


class TestDefaultPagination(TestCase):
    def setUp(self):
        self.request_factory = APIRequestFactory()

    def test_custom_pagination_attributes(self):
        CustomClass = DefaultPagination.custom_class(
            page_size=123, custom_parameter='abc'
        )
        assert CustomClass.custom_parameter == 'abc'
        assert CustomClass.page_size == 123

    def test_with_start_offset(self):
        self.view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=range(1, 101),
            pagination_class=DefaultPagination.custom_class(default_limit=5),
        )
        request = self.request_factory.get('/', {'start': 20})
        response = self.view(request)
        assert response.data['results'] == [21, 22, 23, 24, 25]

        request = self.request_factory.get('/', {'offset': 30})
        response = self.view(request)
        assert response.data['results'] == [31, 32, 33, 34, 35]

    def test_pagination_with_page(self):
        self.view = generics.ListAPIView.as_view(
            serializer_class=PassThroughSerializer,
            queryset=range(1, 101),
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
        assert data[default_limit : default_limit * 2] == response.data['results']
