from unittest.mock import MagicMock, patch

from allauth.socialaccount.models import SocialAccount, SocialApp
from django.contrib.admin.sites import site
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from rest_framework import status

from kobo.apps.accounts.admin import SocialAccountAdmin
from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.kobo_auth.shortcuts import User
from ..forms import UserTokenForm
from .utils import MockProvider


class TestManagedSsoUsers(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.provider = MockProvider(request=RequestFactory().get('/'))
        self.social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=self.provider.id,
            provider_id='kobo',
        )
        self.custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        SocialAppManagedDomain.objects.create(
            domain='example.com', social_app=self.custom_data
        )
        self.user = User.objects.create(username='managed', email='user@example.com')
        self.socialaccount = SocialAccount.objects.create(
            user=self.user,
            provider=self.social_app.provider_id,
            uid='sa12345',
        )
        self.client = Client()

    def test_password_reset_request_not_allowed_for_sso_managed_users(self):
        response = self.client.post(
            reverse('account_reset_password'),
            data={'email': 'user@example.com'},
            HTTP_ACCEPT='application/json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        as_json = response.json()
        errors = as_json['form']['fields']['email']['errors']
        assert 'Cannot set password for SSO-managed accounts' in errors

    # the allauth password change view still returns 200s even with errors in the token
    # form but will show an error rather than the change form
    def test_password_reset_not_allowed_for_sso_managed_users(self):
        check_token = MagicMock(return_value=True)
        token_generator = MagicMock()
        token_generator.check_token = check_token
        with patch.object(UserTokenForm, '_get_user', return_value=self.user):
            with patch.object(
                UserTokenForm, 'token_generator', return_value=token_generator
            ):
                response = self.client.get(
                    reverse(
                        'account_reset_password_from_key',
                        kwargs={'uidb36': self.user.pk, 'key': self.user.pk},
                    ),
                    HTTP_ACCEPT='application/json',
                )
        errors = response.json()['form']['errors']
        html = response.json()['html']
        assert 'Cannot set password for SSO-managed accounts' in errors
        assert 'Password reset failed' in html

    def test_cannot_unlink_managed_sso(self):
        self.client.force_login(self.user)
        response = self.client.delete(
            reverse(
                'socialaccount-detail',
                kwargs={
                    'provider': self.socialaccount.provider,
                    'uid_social_account': self.socialaccount.uid,
                },
            ),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_no_option_to_add_password_in_admin(self):
        def flatten_fieldsets(fieldsets):
            result = []

            for _, options in fieldsets:
                for item in options['fields']:
                    if isinstance(item, (tuple, list)):
                        result.extend(item)
                    else:
                        result.append(item)

            return result

        admin = User.objects.get(username='adminuser')
        self.client.force_login(user=admin)
        # base case: non-managed user, password field should be present
        response = self.client.get(
            reverse('admin:kobo_auth_user_change', kwargs={'object_id': admin.id})
        )
        admin_form = response.context['adminform']
        visible_fields = flatten_fieldsets(admin_form.fieldsets)
        assert 'password' in visible_fields

        # managed user, password field should not be present
        response = self.client.get(
            reverse('admin:kobo_auth_user_change', kwargs={'object_id': self.user.id})
        )
        admin_form = response.context['adminform']
        visible_fields = flatten_fieldsets(admin_form.fieldsets)
        assert 'password' not in visible_fields

    def test_cannot_add_socialaccount_in_admin(self):
        admin = SocialAccountAdmin(SocialAccount, site)
        request = RequestFactory().get('/')
        FormClass = admin.get_form(request=request, obj=None)
        form = FormClass(
            data={
                'user': self.user,
                'provider': 'anotherprovider',
                'uid': '12345',
                'extra_data': {'extra': 'data'},
            }
        )
        assert not form.is_valid()
        assert (
            'Cannot add a new SSO account for SSO-managed user' in form.errors['user']
        )
