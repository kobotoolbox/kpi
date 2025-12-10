from django.test import TestCase
from rest_framework import generics, serializers
from rest_framework.test import APIRequestFactory

from kpi.paginators import DefaultPagination


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
            pagination_class=DefaultPagination.custom_class(page_size=5),
        )
        request = self.request_factory.get('/', {'page': 2})
        response = self.view(request)
        assert response.data['results'] == [6, 7, 8, 9, 10]
