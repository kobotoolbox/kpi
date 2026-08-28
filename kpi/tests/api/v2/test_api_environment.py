import pytest
from constance import config
from constance.test import override_config
from django.conf import settings
from django.http import HttpRequest
from django.template import RequestContext, Template
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from markdown import markdown
from model_bakery import baker
from rest_framework import status

from hub.models.sitewide_message import SitewideMessage
from hub.utils.i18n import I18nUtils
from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.utils.mixins import RequiresStripeAPIKeyMixin
from kpi.utils.fuzzy_int import FuzzyInt
from kpi.utils.markdown import markdownify


class EnvironmentTests(BaseTestCase, RequiresStripeAPIKeyMixin):
    fixtures = ['test_data']

    today = timezone.now()

    @classmethod
    def setUpTestData(cls):
        cls.create_stripe_api_key()

    def setUp(self):
        self.url = reverse('api_v2:environment')
        self.user = User.objects.get(username='someuser')
        self.password = 'someuser'

        baker.make(
            'ExtraProjectMetadataField',
            name='test_field',
            type='text',
            is_required=True,
        )

        self.dict_checks = {
            'terms_of_service_url': config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': config.PRIVACY_POLICY_URL,
            'source_code_url': config.SOURCE_CODE_URL,
            'support_email': config.SUPPORT_EMAIL,
            'support_url': config.SUPPORT_URL,
            'academy_url': config.ACADEMY_URL,
            'community_url': config.COMMUNITY_URL,
            'frontend_min_retry_time': config.FRONTEND_MIN_RETRY_TIME,
            'frontend_max_retry_time': config.FRONTEND_MAX_RETRY_TIME,
            'project_metadata_fields': lambda x: self.assertEqual(
                len(x),
                len(config.PROJECT_METADATA_FIELDS),
            )
            and self.assertIn({'name': 'organization', 'required': False}, x),
            'extra_project_metadata_fields': lambda x: self.assertEqual(len(x), 1)
            and self.assertEqual(x[0]['name'], 'test_field')
            and self.assertEqual(x[0]['required'], True),
            'user_metadata_fields': lambda x: self.assertEqual(
                len(x),
                len(config.USER_METADATA_FIELDS),
            )
            and self.assertIn({'name': 'sector', 'required': False}, x),
            'sector_choices': lambda x: self.assertGreater(len(x), 10)
            and self.assertIn(
                (
                    'Humanitarian - Sanitation, Water & Hygiene',
                    'Humanitarian - Sanitation, Water & Hygiene',
                ),
                x,
            ),
            'operational_purpose_choices': (('', ''),),
            'country_choices': lambda x: self.assertGreater(len(x), 200)
            and self.assertIn(('KEN', 'Kenya'), x),
            'interface_languages': lambda x: self.assertEqual(
                len(x), len(settings.LANGUAGES)
            ),
            'submission_placeholder': SUBMISSION_PLACEHOLDER,
            'asr_mt_features_enabled': False,
            'mfa_enabled': config.MFA_ENABLED,
            'mfa_localized_help_text': markdown(
                I18nUtils.get_mfa_help_text().replace(
                    '##support email##', config.SUPPORT_EMAIL
                )
            ),
            'mfa_code_length': settings.MFA_TOTP_DIGITS,
            'superuser_auth_enforcement': config.SUPERUSER_AUTH_ENFORCEMENT,
            # stripe key added below if stripe is enabled
            'stripe_public_key': None,
            'social_apps': [],
            'enable_password_entropy_meter': (config.ENABLE_PASSWORD_ENTROPY_METER),
            'enable_custom_password_guidance_text': (
                config.ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT
            ),
            'custom_password_localized_help_text': markdown(
                I18nUtils.get_custom_password_help_text()
            ),
            'open_rosa_server': settings.KOBOCAT_URL,
            'terms_of_service__sitewidemessage__exists': False,
            'project_history_log_lifespan': (settings.PROJECT_HISTORY_LOG_LIFESPAN),
            'use_team_label': config.USE_TEAM_LABEL,
            'usage_limit_enforcement': config.USAGE_LIMIT_ENFORCEMENT,
            'allow_self_account_deletion': config.ALLOW_SELF_ACCOUNT_DELETION,
            'registration_open': config.REGISTRATION_OPEN,
            'auth_configuration': {
                'theme': 'default',
                'background_image_url': None,
                'show_kobotoolbox_logo': config.SHOW_KOBOTOOLBOX_LOGO,
                'logo_url': None,
                'supporting_image_url': None,
                'supporting_text': markdownify(I18nUtils.get_sitewide_message()),
                # Derived from allauth, which accepts only a username by default
                'allow_login_with_username': True,
            },
        }
        if settings.STRIPE_ENABLED:
            from djstripe.models import APIKey

            self.dict_checks['stripe_public_key'] = str(
                APIKey.objects.get(
                    type='publishable', livemode=settings.STRIPE_LIVE_MODE
                ).secret
            )

    def _check_response_dict(self, response_dict):
        self.assertEqual(len(response_dict), len(self.dict_checks))
        for key, callable_or_value in self.dict_checks.items():
            response_value = response_dict[key]
            try:
                callable_or_value(response_value)
            except TypeError:
                pass
            else:
                continue
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
        """Not an API test, but hey: nevermind the hobgoblins"""
        context = RequestContext(HttpRequest())  # NB: empty request
        template = Template('{{ config.TERMS_OF_SERVICE_URL }}')
        result = template.render(context)
        self.assertEqual(result, config.TERMS_OF_SERVICE_URL)

    @override_config(MFA_ENABLED=True)
    def test_mfa_value_globally_enabled(self):
        self.client.login(username=self.user.username, password=self.password)
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['mfa_enabled'])

    @override_config(MFA_ENABLED=False)
    def test_mfa_value_globally_disabled(self):
        self.client.login(username=self.user.username, password=self.password)
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['mfa_enabled'])

    @override_settings(SOCIALACCOUNT_PROVIDERS={})
    def test_social_apps(self):
        # GET mutates state, call it first to test num queries later
        self.client.get(self.url, format='json')
        queries = FuzzyInt(18, 36)
        with self.assertNumQueries(queries):
            response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        managed_app = baker.make('socialaccount.SocialApp')
        unmanaged_app = baker.make('socialaccount.SocialApp')
        custom_data = SocialAppCustomData.objects.create(
            social_app=managed_app, is_public=True, managed=True
        )
        custom_data.save()
        SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain='example.com'
        )
        with override_settings(SOCIALACCOUNT_PROVIDERS={'microsoft': {}}):
            with self.assertNumQueries(queries):
                response = self.client.get(self.url, format='json')
        assert len(response.data['social_apps']) == 2
        socialapps_response = sorted(
            response.data['social_apps'], key=lambda k: k['managed']
        )
        assert socialapps_response[0]['managed'] is False
        assert socialapps_response[0]['domains'] == []
        assert socialapps_response[0]['name'] == unmanaged_app.name
        assert socialapps_response[1]['managed'] is True
        assert socialapps_response[1]['domains'] == ['example.com']
        assert socialapps_response[1]['name'] == managed_app.name

    @override_settings(SOCIALACCOUNT_PROVIDERS={})
    def test_social_apps_no_custom_data(self):
        SocialAppCustomData.objects.all().delete()
        self.client.get(self.url, format='json')
        queries = FuzzyInt(18, 36)
        with self.assertNumQueries(queries):
            response = self.client.get(self.url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'social_app')
        self.assertNotContains(response, 'app.name')

    def test_tos_sitewide_message(self):
        """
        Check that fixtures properly stores terms of service
        """

        # Validate environment
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert not response.data['terms_of_service__sitewidemessage__exists']

        # Create SitewideMessage object and check that it properly updates terms
        # of service
        SitewideMessage.objects.create(
            slug='terms_of_service',
            body='tos agreement',
        )
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['terms_of_service__sitewidemessage__exists']

    @pytest.mark.skipif(
        settings.STRIPE_ENABLED, reason='Tests non-stripe functionality'
    )
    def test_stripe_public_key_when_stripe_disabled(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stripe_public_key'] is None

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_stripe_public_key_when_stripe_enabled(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stripe_public_key'] == 'fake_public_key'

    def test_extra_project_metadata_select_fields_options(self):
        baker.make(
            'ExtraProjectMetadataField',
            name='regions',
            type='multi_select',
            options=[
                {"name": "africa", "label": {"default": "Africa"}},  # noqa Q000
                {"name": "europe", "label": {"default": "Europe"}},  # noqa Q000
            ],
        )

        response = self.client.get(self.url, format='json')

        extra_fields = response.data['extra_project_metadata_fields']
        regions_field = next(f for f in extra_fields if f['name'] == 'regions')

        self.assertEqual(len(regions_field['options']), 2)
        self.assertEqual(regions_field['options'][0]['name'], 'africa')
        self.assertEqual(regions_field['options'][0]['label']['default'], 'Africa')

    def test_auth_configuration_defaults_to_unbranded(self):
        """
        A server whose administrator has uploaded nothing gets the default
        theme and no image URLs
        """
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK

        auth_configuration = response.data['auth_configuration']
        assert auth_configuration['theme'] == 'default'
        assert auth_configuration['background_image_url'] is None
        assert auth_configuration['logo_url'] is None
        assert auth_configuration['supporting_image_url'] is None
        assert auth_configuration['show_kobotoolbox_logo'] is True
        assert auth_configuration['allow_login_with_username'] is True

    @override_config(SHOW_KOBOTOOLBOX_LOGO=False)
    def test_auth_configuration_logo_toggle_is_configurable(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['auth_configuration']['show_kobotoolbox_logo'] is False

    @override_settings(ACCOUNT_LOGIN_METHODS={'email'}, ACCOUNT_UNIQUE_EMAIL=True)
    def test_auth_configuration_reports_accepted_login_methods(self):
        """
        The flag follows allauth rather than a preference of its own, so the
        sign-in form never offers a credential the server would reject
        """
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['auth_configuration']['allow_login_with_username'] is False

    def test_auth_configuration_supporting_text_is_rendered_html(self):
        SitewideMessage.objects.filter(slug='welcome_message').update(
            body='Welcome to **this** server'
        )
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert (
            '<strong>this</strong>'
            in response.data['auth_configuration']['supporting_text']
        )

    def test_auth_configuration_supporting_text_is_localized(self):
        response = self.client.get(self.url, format='json', HTTP_ACCEPT_LANGUAGE='fr')
        assert response.status_code == status.HTTP_200_OK
        assert (
            'Le message de bienvenue'
            in response.data['auth_configuration']['supporting_text']
        )

    def test_auth_configuration_supporting_text_is_blank_when_unset(self):
        SitewideMessage.objects.filter(slug__startswith='welcome_message').delete()

        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['auth_configuration']['supporting_text'] == ''

    @override_config(REGISTRATION_OPEN=False)
    def test_registration_open_is_exposed(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['registration_open'] is False

    def test_auth_configuration_available_to_anonymous_users(self):
        """
        The sign-in screen is rendered before the user has any credentials
        """
        self.client.logout()
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'auth_configuration' in response.data
