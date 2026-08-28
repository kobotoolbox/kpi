from unittest.mock import ANY, MagicMock, patch

from allauth.socialaccount.models import SocialAccount, SocialApp
from ddt import data, ddt, unpack
from django.contrib.admin.sites import site
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from rest_framework import status

from kobo.apps.accounts.admin import SocialAccountAdmin
from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.kobo_auth.shortcuts import User
from ..adapter import AccountAdapter
from ..forms import UserTokenForm
from .utils import MockProvider


@ddt
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
        self.user = User.objects.create(username='managed', email='managed@example.com')
        self.exempt_user = User.objects.create(
            username='exempt', email='exempt@example.com'
        )
        self.exempt_user.extra_details.sso_exempt = True
        self.exempt_user.extra_details.save()
        self.socialaccount = SocialAccount.objects.create(
            user=self.user,
            provider=self.social_app.provider_id,
            uid='sa12345',
        )
        self.exempt_socialaccount = SocialAccount.objects.create(
            user=self.exempt_user,
            provider=self.social_app.provider_id,
            uid='sa54321',
        )
        self.client = Client()

    @data(('managed', False), ('exempt', True))
    @unpack
    def test_password_reset_request_for_sso_managed_users(
        self, username, expect_success
    ):
        response = self.client.post(
            reverse('account_reset_password'),
            data={'email': f'{username}@example.com'},
            HTTP_ACCEPT='application/json',
        )
        if expect_success:
            assert response.status_code == status.HTTP_200_OK
        else:
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            as_json = response.json()
            errors = as_json['form']['fields']['email']['errors']
            assert 'Cannot set password for SSO-managed accounts' in errors

    def test_password_reset_request_for_multiple_users_same_email(self):
        anotheruser = User.objects.create_user(
            username='unlinked', email='managed@example.com'
        )
        with patch.object(AccountAdapter, 'send_password_reset_mail') as patched:
            self.client.post(
                reverse('account_reset_password'),
                data={'email': 'managed@example.com'},
                HTTP_ACCEPT='application/json',
            )
            patched.assert_called_once_with(anotheruser, ANY, ANY)

    # the allauth password change view still returns 200s even with errors in the token
    # form but will show an error rather than the change form
    @data(('managed', False), ('exempt', True))
    @unpack
    def test_password_reset_for_sso_managed_users(self, username, expect_success):
        check_token = MagicMock(return_value=True)
        token_generator = MagicMock()
        token_generator.check_token = check_token
        reset_user = User.objects.get(username=username)
        with patch.object(UserTokenForm, '_get_user', return_value=reset_user):
            with patch.object(
                UserTokenForm, 'token_generator', return_value=token_generator
            ):
                response = self.client.get(
                    reverse(
                        'account_reset_password_from_key',
                        kwargs={'uidb36': reset_user.pk, 'key': reset_user.pk},
                    ),
                    HTTP_ACCEPT='application/json',
                )
        errors = response.json()['form']['errors']
        if expect_success:
            assert not errors
        else:
            html = response.json()['html']
            assert 'Cannot set password for SSO-managed accounts' in errors
            assert 'Password reset failed' in html

    @data(('managed', False), ('exempt', True))
    @unpack
    def test_unlink_managed_sso(self, username, expect_success):
        user = User.objects.get(username=username)
        self.client.force_login(user)
        socialaccount = (
            self.socialaccount if username == 'managed' else self.exempt_socialaccount
        )
        response = self.client.delete(
            reverse(
                'socialaccount-detail',
                kwargs={
                    'provider': socialaccount.provider,
                    'uid_social_account': socialaccount.uid,
                },
            ),
        )
        if expect_success:
            assert response.status_code == status.HTTP_204_NO_CONTENT
        else:
            assert response.status_code == status.HTTP_403_FORBIDDEN

    @data(('managed', False), ('exempt', True))
    @unpack
    def test_add_password_in_admin(self, username, expect_password_field):
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
        user = User.objects.get(username=username)
        response = self.client.get(
            reverse('admin:kobo_auth_user_change', kwargs={'object_id': user.id})
        )
        admin_form = response.context['adminform']
        visible_fields = flatten_fieldsets(admin_form.fieldsets)
        if expect_password_field:
            assert 'password' in visible_fields
        else:
            assert 'password' not in visible_fields

    @data(('managed', False), ('exempt', True))
    @unpack
    def test_add_socialaccount_in_admin(self, username, expect_success):
        admin = SocialAccountAdmin(SocialAccount, site)
        request = RequestFactory().get('/')
        user = User.objects.get(username=username)
        FormClass = admin.get_form(request=request, obj=None)
        form = FormClass(
            data={
                'user': user,
                'provider': 'anotherprovider',
                'uid': '12345',
                'extra_data': {'extra': 'data'},
            }
        )
        if expect_success:
            assert form.is_valid()
            assert not form.errors
        else:
            assert not form.is_valid()
            assert (
                'Cannot add a new SSO account for SSO-managed user'
                in form.errors['user']
            )
