from datetime import timedelta
from unittest.mock import ANY, MagicMock, patch

from allauth.socialaccount.models import SocialAccount, SocialApp
from constance.test import override_config
from ddt import data, ddt, unpack
from django.contrib.admin.sites import site
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APIClient

from hub.models import ExtraUserDetail
from kobo.apps.accounts.admin import SocialAccountAdmin
from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.utils import baker_generators  # noqa
from ..adapter import AccountAdapter
from ..forms import UserTokenForm
from ..tasks import (
    DEFAULT_IN_APP_MESSAGE_BODY,
    create_inapp_message,
    managed_sso_sweep,
    notify_unlinked_users,
    update_linked_user,
    update_users,
)
from ..utils import (
    SOCIAL_APP_IDENTIFIER,
    remove_stale_managed_sso_reminders,
    users_needing_update,
)
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

    def test_unlink_unmanaged_sso(self):
        self.socialaccount.delete()
        another_social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider='another-provider',
            provider_id='another-provider-id',
        )
        another_custom_data = SocialAppCustomData.objects.create(
            social_app=another_social_app, managed=False
        )
        SocialAppManagedDomain.objects.filter(domain='example.com').update(
            social_app=another_custom_data
        )

        another_socialaccount = SocialAccount.objects.create(
            user=self.user,
            provider=another_social_app.provider_id,
            uid='sa12345',
        )
        self.client.force_login(User.objects.get(username='managed'))

        response = self.client.delete(
            reverse(
                'socialaccount-detail',
                kwargs={
                    'provider': another_socialaccount.provider,
                    'uid_social_account': another_socialaccount.uid,
                },
            ),
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

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

    @data('managed_off', 'domain_deleted', 'app_deleted')
    def test_restrictions_lift_when_no_longer_managed(self, change):
        """
        Every SSO-managed enforcement point must release once the domain is
        no longer managed, however that state is reached.
        """
        self._make_unmanaged(change)

        # password reset is allowed again
        response = self.client.post(
            reverse('account_reset_password'),
            data={'email': 'managed@example.com'},
            HTTP_ACCEPT='application/json',
        )
        assert response.status_code == status.HTTP_200_OK

        # the SSO account can be unlinked again
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
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # the admin add-social-account form validates again
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
        assert form.is_valid()

    @data(('managed', False), ('unmanaged', True))
    @unpack
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_me_password_change_blocked_only_while_managed(
        self, _label, make_unmanaged
    ):
        """
        The `/me/` password change is blocked while the account is SSO-managed
        and must succeed once the domain is no longer managed.
        """
        self.user.set_password('current-password')
        self.user.save()
        if make_unmanaged:
            self.custom_data.managed = False
            self.custom_data.save()

        api_client = APIClient()
        api_client.force_authenticate(user=self.user)
        response = api_client.patch(
            reverse('currentuser-detail'),
            data={
                'current_password': 'current-password',
                'new_password': 'a-brand-new-password',
            },
            format='json',
        )
        if make_unmanaged:
            assert response.status_code == status.HTTP_200_OK
        else:
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert (
                'Cannot update password for sso-managed account'
                in response.content.decode()
            )

    def _make_unmanaged(self, change):
        if change == 'managed_off':
            self.custom_data.managed = False
            self.custom_data.save()
        elif change == 'domain_deleted':
            SocialAppManagedDomain.objects.get(domain='example.com').delete()
        elif change == 'app_deleted':
            self.social_app.delete()


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

    def test_user_with_several_managed_accounts_is_already_sso_only(self):
        user = self._create_user('two_managed', False, True, False)
        baker.make(
            'socialaccount.SocialAccount',
            user=user,
            provider=self.social_app.provider_id,
        )
        need_update = users_needing_update(self.social_app, domain=self.default_domain)
        assert not need_update.filter(pk=user.pk).exists()

    def test_user_without_extra_details_is_not_exempt(self):
        user = self._create_user('no_extra_details', True, True, False)
        ExtraUserDetail.objects.filter(user=user).delete()
        need_update = users_needing_update(self.social_app, domain=self.default_domain)
        assert need_update.filter(pk=user.pk).exists()

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
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
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
                update_users(custom_data.pk, managed_domain.domain)
                update_users(custom_data.pk, managed_domain.domain)
        patched_update.assert_called_once()
        patched_notify.assert_called_once()

    def test_update_users_skips_in_app_message_when_disabled(self):
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        managed_domain = SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain=self.default_domain
        )
        # Track 1: linked user with a usable password must still be converted.
        linked_user = self._create_user('linked', True, True, False)
        # Track 2: unlinked user must not receive an in-app message.
        unlinked_user = self._create_user('unlinked', True, False, False)

        update_users(custom_data.pk, managed_domain.domain, send_in_app_message=False)

        assert not InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER
        ).exists()
        assert not InAppMessageUsers.objects.filter(user=unlinked_user).exists()

        linked_user.refresh_from_db()
        assert not linked_user.has_usable_password()

    def test_update_users_uses_custom_in_app_message_body(self):
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        managed_domain = SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain=self.default_domain
        )
        self._create_user('unlinked', True, False, False)

        update_users(
            custom_data.pk,
            managed_domain.domain,
            in_app_message_body='custom body text',
        )

        message = InAppMessage.objects.get(
            message_type=MessageType.MANAGED_SSO_REMINDER
        )
        assert message.body == 'custom body text'

    def test_create_inapp_message_defaults_to_constant_body(self):
        message = create_inapp_message(self.social_app)
        assert message.body == DEFAULT_IN_APP_MESSAGE_BODY

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
        # custom data pk
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
        patched_update.assert_any_call(custom_data.pk, self.default_domain)
        patched_update.assert_any_call(custom_data_managed.pk, 'domain1.com')
        patched_update.assert_any_call(custom_data_managed.pk, 'domain2.com')


@ddt
class TestManagedSsoWithdrawal(TestCase):

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
        self.example_domain = SocialAppManagedDomain.objects.create(
            social_app=self.custom_data, domain='example.com'
        )
        self.other_domain = SocialAppManagedDomain.objects.create(
            social_app=self.custom_data, domain='other.com'
        )
        self.alice = User.objects.create(username='alice', email='alice@example.com')
        self.bob = User.objects.create(username='bob', email='bob@other.com')
        self.carol = User.objects.create(username='carol', email='carol@elsewhere.com')
        # Create the reminders through the real path: one message and one
        # recipient row per managed domain.
        update_users(self.custom_data.pk, 'example.com')
        update_users(self.custom_data.pk, 'other.com')
        self.client = Client()

    def test_turning_managed_off_withdraws_reminders(self):
        """
        Turning `managed` off deletes every recipient row and expires the
        emptied reminders.
        """
        self.custom_data.managed = False
        self.custom_data.save()

        assert not InAppMessageUsers.objects.filter(
            in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER
        ).exists()
        messages = InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER
        )
        assert messages.exists()
        now = timezone.now()
        assert all(message.valid_until <= now for message in messages)

        self.client.force_login(self.alice)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 0

    def test_withdrawn_reminder_is_not_broadcast(self):
        """
        A withdrawn reminder must be expired, not left recipient-less: an
        emptied message is otherwise broadcast to every user.
        """
        self.custom_data.managed = False
        self.custom_data.save()

        self.client.force_login(self.carol)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 0

    def test_removing_domain_withdraws_only_that_domain(self):
        """
        Removing one managed domain withdraws only its reminder; the other
        domain's reminder stays live and is not broadcast.
        """
        bob_message = InAppMessageUsers.objects.get(user=self.bob).in_app_message
        alice_message = InAppMessageUsers.objects.get(user=self.alice).in_app_message

        self.other_domain.delete()

        assert not InAppMessageUsers.objects.filter(user=self.bob).exists()
        assert InAppMessageUsers.objects.filter(user=self.alice).exists()

        now = timezone.now()
        bob_message.refresh_from_db()
        alice_message.refresh_from_db()
        assert bob_message.valid_until <= now
        assert alice_message.valid_until > now

        # bob's emptied reminder must not leak to everyone
        self.client.force_login(self.carol)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 0

        self.client.force_login(self.alice)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 1

    def test_deleting_social_app_withdraws_reminders(self):
        """
        Deleting the social app cascades and withdraws every reminder, even
        though messages reference the app only through a JSON field.
        """
        self.social_app.delete()

        assert not InAppMessageUsers.objects.filter(
            in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER
        ).exists()
        messages = InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER
        )
        assert messages.exists()
        now = timezone.now()
        assert all(message.valid_until <= now for message in messages)

        for user in (self.alice, self.carol):
            self.client.force_login(user)
            response = self.client.get('/help/in_app_messages/')
            assert response.json()['count'] == 0

    def test_reenabling_managed_notifies_users_again(self):
        """
        Stale recipient rows must be gone after a turn-off so re-enabling
        can notify the same users again.
        """
        self.custom_data.managed = False
        self.custom_data.save()
        self.custom_data.managed = True
        self.custom_data.save()

        update_users(self.custom_data.pk, 'example.com')

        alice_rows = InAppMessageUsers.objects.filter(user=self.alice)
        assert alice_rows.count() == 1
        message = alice_rows.first().in_app_message
        now = timezone.now()
        assert message.valid_from <= now <= message.valid_until

    @data('managed_off', 'domain_deleted', 'app_deleted')
    def test_update_users_is_noop_when_no_longer_managed(self, change):
        """
        A queued task must re-check state and not strip a password after the
        admin turns managed off, drops the domain or deletes the app.
        """
        linked_user = User.objects.create(username='linked', email='linked@example.com')
        linked_user.set_password('password')
        linked_user.save()
        baker.make(
            'socialaccount.SocialAccount',
            user=linked_user,
            provider=self.social_app.provider_id,
        )
        custom_data_pk = self.custom_data.pk
        message_count_before = InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER
        ).count()

        if change == 'managed_off':
            self.custom_data.managed = False
            self.custom_data.save()
        elif change == 'domain_deleted':
            self.example_domain.delete()
        elif change == 'app_deleted':
            self.social_app.delete()

        update_users(custom_data_pk, 'example.com')

        linked_user.refresh_from_db()
        assert linked_user.has_usable_password()
        assert (
            InAppMessage.objects.filter(
                message_type=MessageType.MANAGED_SSO_REMINDER
            ).count()
            == message_count_before
        )

    def test_sweep_withdraws_reminders_of_a_deleted_app(self):
        """
        A reminder left behind by an app deleted before the cleanup signals
        existed is withdrawn by the nightly sweep; live ones are left alone.
        """
        now = timezone.now()
        orphan = baker.make(
            'help.InAppMessage',
            message_type=MessageType.MANAGED_SSO_REMINDER,
            generic_related_objects={SOCIAL_APP_IDENTIFIER: 999999},
            published=True,
            valid_from=now,
            valid_until=now + timedelta(days=365),
        )
        InAppMessageUsers.objects.create(user=self.carol, in_app_message=orphan)

        with patch('kobo.apps.accounts.tasks.update_users'):
            managed_sso_sweep()

        orphan.refresh_from_db()
        assert not InAppMessageUsers.objects.filter(in_app_message=orphan).exists()
        assert orphan.valid_until <= timezone.now()
        assert InAppMessageUsers.objects.filter(user=self.alice).exists()
        self.client.force_login(self.alice)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 1

    def test_sweep_withdraws_reminders_of_an_unmanaged_app(self):
        """
        `update()` bypasses the signals, like a flag turned off before they
        existed; the sweep must catch up.
        """
        SocialAppCustomData.objects.filter(pk=self.custom_data.pk).update(managed=False)

        remove_stale_managed_sso_reminders()

        assert not InAppMessageUsers.objects.filter(
            in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER
        ).exists()
        messages = InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER
        )
        assert messages.exists()
        now = timezone.now()
        assert all(message.valid_until <= now for message in messages)

    def test_sweep_withdraws_recipients_off_the_managed_domains(self):
        """
        A recipient whose email left the managed domains is withdrawn and the
        emptied reminder expired; the other recipient keeps a live one.
        """
        User.objects.filter(pk=self.bob.pk).update(email='bob@elsewhere.com')

        remove_stale_managed_sso_reminders()

        assert not InAppMessageUsers.objects.filter(user=self.bob).exists()
        assert InAppMessageUsers.objects.filter(user=self.alice).exists()

        self.client.force_login(self.carol)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 0

        self.client.force_login(self.alice)
        response = self.client.get('/help/in_app_messages/')
        assert response.json()['count'] == 1
