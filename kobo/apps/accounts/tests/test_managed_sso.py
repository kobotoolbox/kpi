from unittest.mock import ANY, MagicMock, patch

from allauth.socialaccount.models import SocialAccount, SocialApp
from ddt import data, ddt, unpack
from django.contrib.admin.sites import site
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from model_bakery import baker
from rest_framework import status

from kobo.apps.accounts.admin import SocialAccountAdmin
from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.utils import baker_generators  # noqa
from ..adapter import AccountAdapter
from ..forms import UserTokenForm
from ..tasks import (
    managed_sso_sweep,
    notify_unlinked_users,
    update_linked_user,
    update_users,
)
from ..utils import SOCIAL_APP_IDENTIFIER, users_needing_update
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


class TestManagedSsoCelery(TestCase):

    def setUp(self):
        self.provider = MockProvider(request=RequestFactory().get('/'))
        self.social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=self.provider.id,
            provider_id='kobo',
        )
        self.default_domain = 'example.com'

    def _create_user(
        self,
        username,
        has_password,
        has_managed_account,
        has_unmanaged_account,
        domain=None,
    ):
        domain = domain or self.default_domain
        user = User.objects.create(username=username, email=f'{username}@{domain}')
        if has_password:
            user.set_password('password')
        else:
            user.set_unusable_password()
        user.save()
        if has_managed_account:
            baker.make(
                'socialaccount.SocialAccount',
                user=user,
                provider=self.social_app.provider_id,
            )
        if has_unmanaged_account:
            baker.make(
                'socialaccount.SocialAccount', user=user, provider='another_provider'
            )
        return user

    def test_users_needing_update(self):
        user_with_password = self._create_user('with_password', True, True, False)
        # has both managed and unmanaged social accounts
        user_multiple_accounts = self._create_user(
            'multiple_accounts', False, True, True
        )
        user_no_social_accounts = self._create_user('no_accounts', False, False, False)
        user_only_unmanaged_account = self._create_user(
            'only_unmanaged', False, False, True
        )

        # these users should not be flagged for update
        user_only_managed_account = self._create_user(
            'only_managed', False, True, False
        )
        user_wrong_domain = self._create_user(
            'wrong_domain', True, False, True, 'different.com'
        )
        user_already_received_message = self._create_user(
            'already_received', True, False, False
        )
        message = baker.make(
            'help.InAppMessage',
            generic_related_objects={SOCIAL_APP_IDENTIFIER: self.social_app.id},
            message_type=MessageType.MANAGED_SSO_REMINDER,
        )
        InAppMessageUsers.objects.create(
            user=user_already_received_message, in_app_message=message
        )
        user_sso_exempt = self._create_user('sso_exempt', True, False, True)
        user_sso_exempt.extra_details.sso_exempt = True
        user_sso_exempt.extra_details.save()

        need_update = users_needing_update(self.social_app, domain=self.default_domain)
        need_update = [user.id for user in need_update]

        assert user_with_password.id in need_update
        assert user_multiple_accounts.id in need_update
        assert user_no_social_accounts.id in need_update
        assert user_only_unmanaged_account.id in need_update

        assert user_only_managed_account.id not in need_update
        assert user_wrong_domain.id not in need_update
        assert user_sso_exempt.id not in need_update
        assert user_already_received_message.id not in need_update

    def test_update_linked_user(self):
        user = self._create_user('needs_update', True, True, True)
        update_linked_user(user, self.social_app.provider_id)
        user.refresh_from_db()
        assert not user.has_usable_password()
        linked_accounts = SocialAccount.objects.filter(user=user)
        assert linked_accounts.count() == 1
        account = linked_accounts.first()
        assert account.provider == self.social_app.provider_id

    def test_message_unlinked_users(self):
        requesting_user = User.objects.create(username='adminuser')
        user = self._create_user('needs_update', True, False, False)
        notify_unlinked_users([user.id], self.social_app, requesting_user)
        # the following will fail if the message has not been created or if
        # there are multiple
        message = InAppMessage.objects.get(
            message_type=MessageType.MANAGED_SSO_REMINDER,
            generic_related_objects__contains={
                SOCIAL_APP_IDENTIFIER: self.social_app.id
            },
        )
        InAppMessageUsers.objects.get(user=user, in_app_message=message)

    def test_update_users_only_updates_once(self):
        custom_data = SocialAppCustomData.objects.create(social_app=self.social_app)
        managed_domain = SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain=self.default_domain
        )
        self._create_user('multiple_accounts', False, True, True)
        self._create_user('no_accounts', True, False, False)
        with patch(
            'kobo.apps.accounts.tasks.update_linked_user', wraps=update_linked_user
        ) as patched_update:
            with patch(
                'kobo.apps.accounts.tasks.notify_unlinked_users',
                wraps=notify_unlinked_users,
            ) as patched_notify:
                update_users(custom_data, managed_domain.domain)
                update_users(custom_data, managed_domain.domain)
        patched_update.assert_called_once()
        patched_notify.assert_called_once()

    def test_managed_sso_sweep(self):
        social_app_managed = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=self.provider.id,
            provider_id='managed',
        )
        social_app_unmanaged = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=self.provider.id,
            provider_id='unmanaged',
        )
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        custom_data_managed = SocialAppCustomData.objects.create(
            social_app=social_app_managed, managed=True
        )

        # unamanged domain should be skipped
        SocialAppCustomData.objects.create(
            social_app=social_app_unmanaged, managed=False
        )

        # update_users should be called for all three domains with the correct
        # custom data object
        SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain=self.default_domain
        )
        SocialAppManagedDomain.objects.create(
            social_app=custom_data_managed, domain='domain1.com'
        )
        SocialAppManagedDomain.objects.create(
            social_app=custom_data_managed, domain='domain2.com'
        )
        with patch('kobo.apps.accounts.tasks.update_users') as patched_update:
            managed_sso_sweep()
        assert patched_update.call_count == 3
        patched_update.assert_any_call(custom_data, self.default_domain)
        patched_update.assert_any_call(custom_data_managed, 'domain1.com')
        patched_update.assert_any_call(custom_data_managed, 'domain2.com')
