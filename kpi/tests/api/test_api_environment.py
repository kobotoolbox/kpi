import datetime

import constance
import pytest
from constance.test import override_config
from django.conf import settings
from django.http import HttpRequest
from django.template import RequestContext, Template
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from djstripe.models import APIKey
from markdown import markdown
from model_bakery import baker
from rest_framework import status

from hub.models.sitewide_message import SitewideMessage
from hub.utils.i18n import I18nUtils
from kobo.apps.accounts.mfa.models import MfaAvailableToUser
from kobo.apps.accounts.models import SocialAppCustomData
from kobo.apps.constance_backends.utils import to_python_object
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.constants import FREE_TIER_NO_THRESHOLDS, FREE_TIER_EMPTY_DISPLAY
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.fuzzy_int import FuzzyInt
from kpi.utils.object_permission import get_database_user


class EnvironmentTests(BaseTestCase):
    fixtures = ['test_data']

    today = timezone.now()
    free_tier_thresholds = {
        'storage': 11111111111111,
        'data': 2222222222222,
        'transcription_minutes': 333333,
        'translation_chars': 4444444,
    }
    free_tier_display = {
      'name': 'Test',
      'features': [
          'Feature 1',
          'Feature 2',
      ]
    }

    def setUp(self):
        self.url = reverse('environment')
        self.user = User.objects.get(username='someuser')
        self.password = 'someuser'
        self.dict_checks = {
            'terms_of_service_url': constance.config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': constance.config.PRIVACY_POLICY_URL,
            'source_code_url': constance.config.SOURCE_CODE_URL,
            'support_email': constance.config.SUPPORT_EMAIL,
            'support_url': constance.config.SUPPORT_URL,
            'academy_url': constance.config.ACADEMY_URL,
            'community_url': constance.config.COMMUNITY_URL,
            'frontend_min_retry_time': constance.config.FRONTEND_MIN_RETRY_TIME,
            'frontend_max_retry_time': constance.config.FRONTEND_MAX_RETRY_TIME,
            'project_metadata_fields': lambda x: self.assertEqual(
                len(x),
                len(to_python_object(constance.config.PROJECT_METADATA_FIELDS)),
            )
            and self.assertIn({'name': 'organization', 'required': False}, x),
            'user_metadata_fields': lambda x: self.assertEqual(
                len(x),
                len(to_python_object(constance.config.USER_METADATA_FIELDS)),
            )
            and self.assertIn({'name': 'sector', 'required': False}, x),
            'sector_choices': lambda x: self.assertGreater(len(x), 10)
            and self.assertIn(
                (
                    "Humanitarian - Sanitation, Water & Hygiene",
                    "Humanitarian - Sanitation, Water & Hygiene",
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
            'mfa_enabled': constance.config.MFA_ENABLED,
            'mfa_per_user_availability': lambda response: (
                MfaAvailableToUser.objects.filter(
                    user=get_database_user(self.user)
                ).exists(),
            ),
            'mfa_has_availability_list': lambda response: (
                MfaAvailableToUser.objects.all().exists()
            ),
            'mfa_localized_help_text': markdown(
                I18nUtils.get_mfa_help_text().replace(
                    '##support email##', constance.config.SUPPORT_EMAIL
                )
            ),
            'mfa_code_length': settings.TRENCH_AUTH['CODE_LENGTH'],
            'stripe_public_key': (
                str(
                    APIKey.objects.get(
                        type='publishable', livemode=settings.STRIPE_LIVE_MODE
                    ).secret
                )
                if settings.STRIPE_ENABLED
                else None
            ),
            'free_tier_thresholds': to_python_object(
                constance.config.FREE_TIER_THRESHOLDS
            ),
            'free_tier_display': to_python_object(
                constance.config.FREE_TIER_DISPLAY
            ),
            'social_apps': [],
            'enable_password_entropy_meter': (
                constance.config.ENABLE_PASSWORD_ENTROPY_METER
            ),
            'enable_custom_password_guidance_text': (
                constance.config.ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT
            ),
            'custom_password_localized_help_text': markdown(
                I18nUtils.get_custom_password_help_text()
            ),
            'open_rosa_server': settings.KOBOCAT_URL,
            'terms_of_service__sitewidemessage__exists': False,
            'project_history_log_lifespan': (
                constance.config.PROJECT_HISTORY_LOG_LIFESPAN
            ),
            'use_team_label': constance.config.USE_TEAM_LABEL,
        }

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
        """ Not an API test, but hey: nevermind the hobgoblins """
        context = RequestContext(HttpRequest())  # NB: empty request
        template = Template('{{ config.TERMS_OF_SERVICE_URL }}')
        result = template.render(context)
        self.assertEqual(result, constance.config.TERMS_OF_SERVICE_URL)

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

    @override_config(MFA_ENABLED=True)
    def test_mfa_per_user_availability_while_globally_enabled(self):
        # When MFA is globally enabled, it is allowed for everyone *until* the
        # first per-user allowance (`MfaAvailableToUser` instance) is created.

        # Enable MFA only for someuser
        baker.make('MfaAvailableToUser', user=self.user)

        # someuser should have per-user availability
        self.assertTrue(
            self.client.login(
                username=self.user.username, password=self.password
            )
        )
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['mfa_enabled'])
        self.assertTrue(response.data['mfa_per_user_availability'])
        self.assertTrue(response.data['mfa_has_availability_list'])
        self._check_response_dict(response.data)

        # anotheruser should **NOT** have per-user availability
        self.user = User.objects.get(username='anotheruser')
        self.password = 'anotheruser'
        self.client.login(username=self.user.username, password=self.password)
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['mfa_enabled'])
        self.assertFalse(response.data['mfa_per_user_availability'])
        self.assertTrue(response.data['mfa_has_availability_list'])
        self._check_response_dict(response.data)

    @override_config(MFA_ENABLED=True)
    def test_mfa_per_user_availability_while_globally_enabled_as_anonymous(
        self,
    ):
        # Enable MFA only for someuser, in order to enter per-user-allowance
        # mode. MFA should then appear to be disabled for everyone else
        # (including anonymous users), even though MFA is globally enabled.
        someuser = User.objects.get(username='someuser')
        baker.make('MfaAvailableToUser', user=someuser)

        # Now, make sure that the application reports MFA to be disabled for
        # anonymous users
        self.client.logout()
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['mfa_enabled'])
        self.assertFalse(response.data['mfa_per_user_availability'])
        self.assertTrue(response.data['mfa_has_availability_list'])

    @override_config(
        FREE_TIER_CUTOFF_DATE=today.date(),
        FREE_TIER_THRESHOLDS=free_tier_thresholds,
        FREE_TIER_DISPLAY=free_tier_display,
    )
    def test_free_tier_override_respects_cutoff_date(
        self,
    ):
        user = baker.make(
            settings.AUTH_USER_MODEL,
            username='thresholds_test',
            date_joined=self.today
        )
        self.client.force_login(user)

        # A user who joined today should see the custom free tier
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['free_tier_thresholds'], self.free_tier_thresholds)
        self.assertEqual(response.data['free_tier_display'], self.free_tier_display)

        # A user who joined yesterday should see the custom free tier
        user.date_joined = self.today - datetime.timedelta(days=1)
        user.save()
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['free_tier_thresholds'], self.free_tier_thresholds)
        self.assertEqual(response.data['free_tier_display'], self.free_tier_display)

        # A user who joined tomorrow should *not* see the custom free tier
        user.date_joined = self.today + datetime.timedelta(days=1)
        user.save()
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['free_tier_thresholds'], FREE_TIER_NO_THRESHOLDS)
        self.assertEqual(response.data['free_tier_display'], FREE_TIER_EMPTY_DISPLAY)

    @pytest.mark.skip(
        'The "FREE_TIER_CUTOFF_DATE" has passed. '
        'The related conditions are no longer applicable.'
    )
    @override_config(
        FREE_TIER_CUTOFF_DATE=today.date(),
        FREE_TIER_THRESHOLDS=free_tier_thresholds,
        FREE_TIER_DISPLAY=free_tier_display,
    )
    def test_free_tier_override_uses_organization_owner_join_date(
        self,
    ):
        """
        If the user is in an organization, the custom free tier should only
        be displayed if the organization owner joined on/before FREE_TIER_CUTOFF_DATE
        """
        org_user = baker.make(
            settings.AUTH_USER_MODEL,
            username='org_user',
            date_joined=self.today + datetime.timedelta(days=1),
        )
        org_owner = baker.make(
            settings.AUTH_USER_MODEL,
            username='org_owner',
            date_joined=self.today,
        )

        organization = baker.make('Organization')
        # The first user added to the organization automatically becomes the owner
        organization.add_user(org_owner)
        organization.add_user(org_user)
        organization.save()
        self.client.force_login(org_user)

        # a user whose organization owner registered today should see the custom free tier
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['free_tier_thresholds'], self.free_tier_thresholds)
        self.assertEqual(response.data['free_tier_display'], self.free_tier_display)

        # a user whose organization owner registered tomorrow should *not* see the custom free tier
        org_owner.date_joined = self.today + datetime.timedelta(days=1)
        org_owner.save()
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['free_tier_thresholds'], FREE_TIER_NO_THRESHOLDS)
        self.assertEqual(response.data['free_tier_display'], FREE_TIER_EMPTY_DISPLAY)

    @override_settings(SOCIALACCOUNT_PROVIDERS={}, STRIPE_ENABLED=False)
    def test_social_apps(self):
        # GET mutates state, call it first to test num queries later
        self.client.get(self.url, format='json')
        queries = FuzzyInt(18, 28)
        with self.assertNumQueries(queries):
            response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        app = baker.make('socialaccount.SocialApp')
        custom_data = SocialAppCustomData.objects.create(
            social_app=app,
            is_public=True
        )
        custom_data.save()
        with override_settings(SOCIALACCOUNT_PROVIDERS={'microsoft': {}}):
            with self.assertNumQueries(queries):
                response = self.client.get(self.url, format='json')
        self.assertContains(response, app.name)

    @override_settings(SOCIALACCOUNT_PROVIDERS={}, STRIPE_ENABLED=False)
    def test_social_apps_no_custom_data(self):
        SocialAppCustomData.objects.all().delete()
        self.client.get(self.url, format='json')
        queries = FuzzyInt(18, 28)
        with self.assertNumQueries(queries):
            response = self.client.get(self.url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'social_app')
        self.assertNotContains(response, 'app.name')

    def test_tos_sitewide_message(self):
        # Check that fixtures properly stores terms of service
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert not response.data['terms_of_service__sitewidemessage__exists']

        # Create SitewideMessage object and check that it properly updates terms of service
        SitewideMessage.objects.create(
            slug='terms_of_service',
            body='tos agreement',
        )
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['terms_of_service__sitewidemessage__exists']

    @override_settings(STRIPE_ENABLED=False)
    def test_stripe_public_key_when_stripe_disabled(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stripe_public_key'] is None

    def test_stripe_public_key_when_stripe_enabled(self):
        response = self.client.get(self.url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stripe_public_key'] == 'fake_public_key'
