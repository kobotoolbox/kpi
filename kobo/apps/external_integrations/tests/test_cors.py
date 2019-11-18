# coding: utf-8
from django.urls import reverse
from rest_framework.test import APITestCase

from ..models import CorsModel


class CorsTests(APITestCase):
    def setUp(self):
        self.innocuous_url = reverse('environment')
        self.cors_response_header_name = 'Access-Control-Allow-Origin'

    def test_no_cors_response_without_origin(self):
        response = self.client.get(self.innocuous_url)
        self.assertFalse(response.has_header(self.cors_response_header_name))

    def test_no_cors_response_with_untrusted_origin(self):
        response = self.client.get(
            self.innocuous_url,
            # I saw it with a debugger, but I thought I might've been crazy
            # until I read https://stackoverflow.com/a/49924911
            HTTP_ORIGIN='http://amazon.com',
        )
        self.assertFalse(response.has_header(self.cors_response_header_name))

    def test_cors_response_with_trusted_origin(self):
        trusted_origin = 'https://www.fsf.org'
        CorsModel.objects.create(cors=trusted_origin)
        response = self.client.get(
            self.innocuous_url,
            HTTP_ORIGIN=trusted_origin,
        )
        self.assertTrue(response.has_header(self.cors_response_header_name))
        self.assertEqual(response[self.cors_response_header_name],
                         trusted_origin)
