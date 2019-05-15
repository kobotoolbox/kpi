# -*- coding: utf-8 -*-
from __future__ import absolute_import

import constance
from django.http import HttpRequest
from django.core.urlresolvers import reverse
from django.template import Template, RequestContext
from rest_framework import status
from rest_framework.test import APITestCase


class EnvironmentTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.url = reverse('environment')
        self.expected_dict = {
            'terms_of_service_url': constance.config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': constance.config.PRIVACY_POLICY_URL,
            'source_code_url': constance.config.SOURCE_CODE_URL,
            'support_url': constance.config.SUPPORT_URL,
            'support_email': constance.config.SUPPORT_EMAIL,
        }

    def test_anonymous_succeeds(self):
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertDictEqual(response.data, self.expected_dict)

    def test_authenticated_succeeds(self):
        self.client.login(username='admin', password='pass')
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertDictEqual(response.data, self.expected_dict)

    def test_template_context_processor(self):
        """ Not an API test, but hey: nevermind the hobgoblins """
        context = RequestContext(HttpRequest())  # NB: empty request
        template = Template('{{ config.TERMS_OF_SERVICE_URL }}')
        result = template.render(context)
        self.assertEqual(result, constance.config.TERMS_OF_SERVICE_URL)
