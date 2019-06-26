# -*- coding: utf-8 -*-
# 😇

from __future__ import unicode_literals
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
        self.dict_checks = {
            'terms_of_service_url': constance.config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': constance.config.PRIVACY_POLICY_URL,
            'source_code_url': constance.config.SOURCE_CODE_URL,
            'support_url': constance.config.SUPPORT_URL,
            'support_email': constance.config.SUPPORT_EMAIL,
            'available_sectors': lambda x: \
                len(x) > 10 and ("Humanitarian - Sanitation, Water & Hygiene",
                    "Humanitarian - Sanitation, Water & Hygiene"
                ) in x,
            'available_countries': lambda x: \
                len(x) > 200 and ('KEN', 'Kenya') in x,
            'all_languages': lambda x: \
                len(x) > 100 and ('fa', 'Persian') in x,
            'interface_languages': lambda x: \
                len(x) > 5 and ('ar', 'العربيّة') in x,
        }

    def _check_response_dict(self, response_dict):
        self.assertEqual(len(response_dict), len(self.dict_checks))
        for key, callable_or_value in self.dict_checks.items():
            try:
                self.assertTrue(callable_or_value(response_dict[key]))
            except TypeError:
                self.assertEqual(response_dict[key], callable_or_value)

    def test_anonymous_succeeds(self):
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._check_response_dict(response.data)

    def test_authenticated_succeeds(self):
        self.client.login(username='admin', password='pass')
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._check_response_dict(response.data)


    def test_template_context_processor(self):
        ''' Not an API test, but hey: nevermind the hobgoblins '''
        context = RequestContext(HttpRequest()) # NB: empty request
        template = Template('{{ config.TERMS_OF_SERVICE_URL }}')
        result = template.render(context)
        self.assertEqual(result, constance.config.TERMS_OF_SERVICE_URL)
