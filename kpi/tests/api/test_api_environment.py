# coding: utf-8
# 😇
import constance
from django.urls import reverse
from django.http import HttpRequest
from django.template import Template, RequestContext
from rest_framework import status

from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kpi.tests.base_test_case import BaseTestCase


class EnvironmentTests(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.url = reverse('environment')
        self.dict_checks = {
            'terms_of_service_url': constance.config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': constance.config.PRIVACY_POLICY_URL,
            'source_code_url': constance.config.SOURCE_CODE_URL,
            'support_email': constance.config.SUPPORT_EMAIL,
            'support_url': constance.config.SUPPORT_URL,
            'community_url': constance.config.COMMUNITY_URL,
            'available_sectors': lambda x: \
                self.assertGreater(len(x), 10) and self.assertIn(
                    ("Humanitarian - Sanitation, Water & Hygiene",
                     "Humanitarian - Sanitation, Water & Hygiene"),
                    x
                ),
            'available_countries': lambda x: \
                self.assertGreater(len(x), 200) and self.assertIn(
                    ('KEN', 'Kenya'), x
                ),
            'all_languages': lambda x: \
                self.assertGreater(len(x), 100) and self.assertIn(
                    ('fa', 'Persian'), x
                ),
            'interface_languages': lambda x: \
                self.assertGreater(len(x), 5) and self.assertIn(
                    ('ar', 'العربيّة'), x
                ),
            'submission_placeholder': SUBMISSION_PLACEHOLDER,
        }

    def _check_response_dict(self, response_dict):
        self.assertEqual(len(response_dict), len(self.dict_checks))
        for key, callable_or_value in self.dict_checks.items():
            response_value = response_dict[key]
            try:
                callable_or_value(response_value)
            except TypeError:
                self.assertEqual(response_value, callable_or_value)

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
        """ Not an API test, but hey: nevermind the hobgoblins """
        context = RequestContext(HttpRequest())  # NB: empty request
        template = Template('{{ config.TERMS_OF_SERVICE_URL }}')
        result = template.render(context)
        self.assertEqual(result, constance.config.TERMS_OF_SERVICE_URL)
