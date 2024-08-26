# coding: utf-8
from allauth.account.models import EmailAddress
from constance.test import override_config
from django.conf import settings
from django.shortcuts import resolve_url
from django.template.response import TemplateResponse
from django.test import override_settings
from django.urls import reverse
from djstripe.models import Customer, Price, SubscriptionItem, Subscription
from model_bakery import baker
from rest_framework import status
from trench.utils import get_mfa_model

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.accounts.mfa.forms import MfaLoginForm
from kobo.apps.accounts.mfa.models import MfaAvailableToUser
from kobo.apps.organizations.models import Organization, OrganizationUser
from kpi.tests.kpi_test_case import KpiTestCase


class TestStripeMFALogin(KpiTestCase):
    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        # Confirm someuser's e-mail address as primary and verified
        email_address, _ = EmailAddress.objects.get_or_create(
            user=self.someuser
        )
        email_address.primary = True
        email_address.verified = True
        email_address.save()

        # Activate MFA for someuser
        self.mfa_object = get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        # Ensure `self.client` is not authenticated
        self.client.logout()

        self.organization = baker.make(
            Organization, id='orgSALFMLFMSDGmgdlsgmsd'
        )
        self.organization_user = baker.make(
            OrganizationUser,
            user=self.someuser,
            organization=self.organization,
        )

    def _create_subscription(self, unit_amount=0, billing_status='active'):
        self.customer = baker.make(Customer, subscriber=self.organization)
        self.price = baker.make(Price, unit_amount=unit_amount)
        self.subscription_item = baker.make(SubscriptionItem, price=self.price)
        self.subscription = baker.make(
            Subscription,
            customer=self.customer,
            items=[self.subscription_item],
            status=billing_status,
        )

    def _reset_whitelist(self, whitelisted_users=[]):
        MfaAvailableToUser.objects.all().delete()
        for user in whitelisted_users:
            MfaAvailableToUser.objects.create(user=user)

    def _assert_mfa_login(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'verification token')

    def _assert_no_mfa_login(self, response):
        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        self.assertEqual(resolve_url(settings.LOGIN_REDIRECT_URL), redirection)

    @override_config(MFA_ENABLED=True)
    def test_no_mfa_login_without_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user doesn't have a paid subscription
        """
        # Enable whitelist but do not whitelist self.someuser
        self._reset_whitelist([self.anotheruser])
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_no_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_works_with_paid_subscription(self):
        """
        Validate that multi-factor authentication form is displayed after
        successful login if the user has a paid subscription
        """
        # Enable whitelist but do not whitelist self.someuser
        self._reset_whitelist([self.anotheruser])
        self._create_subscription(unit_amount=2000)

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_without_subscription_no_whitelist(self):
        """
        Validate MFA form is displayed after login when the user
        has no subscription and whitelist is disabled
        """
        self._reset_whitelist()
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_without_subscription_but_whitelisted(self):
        """
        Validate MFA form is displayed after login when the user
        has no subscription but is whitelisted
        """
        self._reset_whitelist([self.someuser])
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_no_mfa_login_with_free_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user has a free subscription
        """
        self._reset_whitelist([self.anotheruser])
        self._create_subscription()

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_no_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_with_free_subscription_and_whitelisted(self):
        """
        Validate MFA form is displayed after login when the user
        has free subscription and is whitelisted
        """
        self._reset_whitelist([self.someuser])
        self._create_subscription()

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_with_free_subscription_no_whitelist(self):
        """
        Validate MFA form is displayed after login when the user
        has free subscription and whitelist is disabled
        """
        self._reset_whitelist()
        self._create_subscription()

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_with_canceled_subscription_but_previously_set(self):
        """
        Validate that multi-factor authentication form is displayed after
        successful login if the user only has a cancelled subscription
        but MFA was enabled before subscription was canceled.
        """
        self._reset_whitelist([self.anotheruser])
        self._create_subscription(unit_amount=2000, billing_status='canceled')

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_no_mfa_login_with_canceled_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user only has a cancelled subscription and
        MFA was not enabled before.
        """
        self._reset_whitelist([self.anotheruser])
        self._create_subscription(billing_status='canceled')
        self.mfa_object.delete()
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self._assert_no_mfa_login(response)

    @override_config(MFA_ENABLED=True)
    def test_no_mfa_login_with_wrong_password(self):
        """
        Test if MFA by-pass does not create a hole and let the
        user log in with wrong credentials.
        """

        data = {
            'login': 'someuser',
            'password': 'badpassword',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self.assertEqual(len(response.redirect_chain), 0)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response, TemplateResponse)
        self.assertFalse(response.context_data['form'].is_valid())
        self.assertIsInstance(response.context_data['form'], MfaLoginForm)

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_per_user_availability_no_subscription(self):
        """
        Validate that multi-factor authentication form is displayed after
        successful login if the user has no subscription but has per user
        availability set up
        """
        baker.make('MfaAvailableToUser', user=self.someuser)

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'verification token')

    @override_config(MFA_ENABLED=False)
    def test_mfa_globally_disabled_as_user_with_paid_subscription(self):
        """
        Validate that multi-factor authentication form isn't displayed after
        successful login if the user has a paid, active subscription but
        MFA setting is globally disabled
        """
        self._create_subscription(billing_status='active')

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        self.assertEqual(resolve_url(settings.LOGIN_REDIRECT_URL), redirection)
