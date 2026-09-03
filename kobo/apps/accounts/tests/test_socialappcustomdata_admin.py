from allauth.socialaccount.models import SocialAccount, SocialApp
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.accounts.tasks import DEFAULT_IN_APP_MESSAGE_BODY
from kobo.apps.accounts.tests.utils import MockProvider
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User


class SocialAppCustomDataAdminTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin_user = User.objects.get(username='adminuser')
        self.provider = MockProvider(request=RequestFactory().get('/'))
        self.social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=self.provider.id,
            provider_id='test_provider',
        )
        self.custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app,
            managed=False,
            is_public=True,
        )
        self.client = Client()
        self.client.force_login(self.admin_user)

    def _get_change_post_data(
        self,
        managed=True,
        domains=None,
        confirmed=False,
        send_in_app_message=None,
        in_app_message_body=None,
    ):
        domains = domains or []
        data = {
            'social_app': self.social_app.pk,
            'is_public': 'on',
            'domains-TOTAL_FORMS': str(len(domains) + 1),
            'domains-INITIAL_FORMS': '0',
            'domains-MIN_NUM_FORMS': '0',
            'domains-MAX_NUM_FORMS': '1000',
            '_save': 'Save',
        }
        if managed:
            data['managed'] = 'on'
        for i, domain in enumerate(domains):
            data[f'domains-{i}-domain'] = domain
            data[f'domains-{i}-id'] = ''
        data[f'domains-{len(domains)}-domain'] = ''
        data[f'domains-{len(domains)}-id'] = ''
        if confirmed:
            data['_confirmed'] = '1'
        if send_in_app_message is not None:
            data['send_in_app_message'] = send_in_app_message
        if in_app_message_body is not None:
            data['in_app_message_body'] = in_app_message_body
        return data

    def test_get_change_view(self):
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'admin/change_form.html')

    def test_post_add_socialappcustomdata_without_managed(self):
        new_app = SocialApp.objects.create(
            client_id='new.service.id',
            secret='new.service.secret',
            name='New App',
            provider=self.provider.id,
            provider_id='new_provider',
        )
        url = reverse('admin:accounts_socialappcustomdata_add')
        data = {
            'social_app': new_app.pk,
            'is_public': 'on',
            'domains-TOTAL_FORMS': '2',
            'domains-INITIAL_FORMS': '0',
            'domains-MIN_NUM_FORMS': '0',
            'domains-MAX_NUM_FORMS': '1000',
            'domains-0-domain': 'example.org',
            'domains-0-id': '',
            'domains-1-domain': '',
            'domains-1-id': '',
            '_save': 'Save',
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 302)
        created_custom_data = SocialAppCustomData.objects.get(social_app=new_app)
        self.assertFalse(created_custom_data.managed)
        self.assertEqual(
            list(created_custom_data.domains.values_list('domain', flat=True)),
            ['example.org'],
        )

    def test_post_toggle_managed_shows_confirmation(self):
        # Linked user (Track 1)
        linked_user = User.objects.create(
            username='linked_user', email='linked@example.com'
        )
        SocialAccount.objects.create(
            user=linked_user,
            provider=self.social_app.provider_id,
            uid='sa101',
        )
        # Exempt user (Skipped from Track 1)
        exempt_user = User.objects.create(
            username='exempt_user', email='exempt@example.com'
        )
        exempt_user.extra_details.sso_exempt = True
        exempt_user.extra_details.save()
        SocialAccount.objects.create(
            user=exempt_user,
            provider=self.social_app.provider_id,
            uid='sa102',
        )
        # Unlinked user with matching domain (Track 2)
        User.objects.create(username='unlinked_user', email='unlinked@example.com')

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(
            response, 'admin/accounts/socialappcustomdata/confirmation.html'
        )
        self.assertEqual(response.context['track_1_count'], 1)
        self.assertEqual(response.context['track_2_count'], 1)
        self.assertEqual(response.context['submitted_domains'], ['example.com'])
        self.assertTrue(response.context['managed_toggled_on'])

        # Verify nothing changed in DB yet
        self.custom_data.refresh_from_db()
        self.assertFalse(self.custom_data.managed)
        self.assertEqual(self.custom_data.domains.count(), 0)

    def test_counts_only_include_accounts_the_task_will_update(self):
        # Linked user on the managed domain who still has a password (Track 1)
        linked_user = User.objects.create(
            username='linked_user', email='linked@example.com'
        )
        linked_user.set_password('password')
        linked_user.save()
        SocialAccount.objects.create(
            user=linked_user, provider=self.social_app.provider_id, uid='sa201'
        )
        # Linked user already converted to SSO-only: nothing left to do
        converted_user = User.objects.create(
            username='converted_user', email='converted@example.com'
        )
        converted_user.set_unusable_password()
        converted_user.save()
        SocialAccount.objects.create(
            user=converted_user, provider=self.social_app.provider_id, uid='sa202'
        )
        # Linked user on a domain that is not managed by this SocialApp
        other_domain_user = User.objects.create(
            username='other_domain_user', email='other@unmanaged.org'
        )
        other_domain_user.set_password('password')
        other_domain_user.save()
        SocialAccount.objects.create(
            user=other_domain_user, provider=self.social_app.provider_id, uid='sa203'
        )

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['track_1_count'], 1)
        self.assertEqual(response.context['track_2_count'], 0)

    def test_post_toggle_managed_confirmed_saves(self):
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=True
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 302)
        self.custom_data.refresh_from_db()
        self.assertTrue(self.custom_data.managed)
        self.assertEqual(
            list(self.custom_data.domains.values_list('domain', flat=True)),
            ['example.com'],
        )

    def test_post_add_domain_when_managed_shows_confirmation(self):
        self.custom_data.managed = True
        self.custom_data.save()
        SocialAppManagedDomain.objects.create(
            social_app=self.custom_data, domain='existing.com'
        )

        # Unlinked user for new domain
        User.objects.create(username='new_user', email='user@newdomain.com')

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        data = {
            'social_app': self.social_app.pk,
            'is_public': 'on',
            'managed': 'on',
            'domains-TOTAL_FORMS': '3',
            'domains-INITIAL_FORMS': '1',
            'domains-MIN_NUM_FORMS': '0',
            'domains-MAX_NUM_FORMS': '1000',
            'domains-0-domain': 'existing.com',
            'domains-0-id': str(self.custom_data.domains.first().pk),
            'domains-1-domain': 'newdomain.com',
            'domains-1-id': '',
            'domains-2-domain': '',
            'domains-2-id': '',
            '_save': 'Save',
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(
            response, 'admin/accounts/socialappcustomdata/confirmation.html'
        )
        self.assertEqual(response.context['track_2_count'], 1)
        self.assertIn('newdomain.com', response.context['added_domains'])

    def test_track_2_idempotence_excludes_already_notified_users(self):
        unlinked_user = User.objects.create(
            username='already_notified', email='already@example.com'
        )
        social_app_key = f'{SocialApp._meta.app_label}.{SocialApp._meta.model_name}'
        iam = InAppMessage.objects.create(
            title='SSO Nudge',
            snippet='Please link SSO',
            body='Please link SSO',
            published=True,
            last_editor=self.admin_user,
            generic_related_objects={social_app_key: self.social_app.pk},
            message_type=MessageType.MANAGED_SSO_REMINDER,
        )
        InAppMessageUsers.objects.create(user=unlinked_user, in_app_message=iam)

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['track_2_count'], 0)

    def test_post_toggle_managed_off_shows_confirmation(self):
        self.custom_data.managed = True
        self.custom_data.save()

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=False, domains=[], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(
            response, 'admin/accounts/socialappcustomdata/confirmation.html'
        )
        self.assertTrue(response.context['managed_toggled_off'])

        # Confirm turn off
        post_data['_confirmed'] = '1'
        response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 302)
        self.custom_data.refresh_from_db()
        self.assertFalse(self.custom_data.managed)

    def test_invalid_domain_shows_form_error_not_confirmation(self):
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['invalid_domain_format'], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'admin/change_form.html')
        self.assertTemplateNotUsed(
            response, 'admin/accounts/socialappcustomdata/confirmation.html'
        )

    def test_post_without_change_permission_raises_forbidden(self):
        non_staff = User.objects.create(
            username='regular_staff', email='staff@example.com', is_staff=True
        )
        self.client.force_login(non_staff)
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=False
        )
        response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 403)

    def test_confirmation_shows_in_app_message_field_when_enabling_managed(self):
        # Catches the field being absent or unchecked/blank by default when
        # managed SSO is turned on.
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context['send_in_app_message'])
        self.assertEqual(
            response.context['in_app_message_body'], DEFAULT_IN_APP_MESSAGE_BODY
        )
        self.assertContains(response, 'name="in_app_message_body"')

    def test_confirmation_hides_in_app_message_field_when_disabling_managed(self):
        # Turning managed off must never expose the in-app message controls.
        self.custom_data.managed = True
        self.custom_data.save()

        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=False, domains=[], confirmed=False
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="send_in_app_message"')

    def test_confirmed_with_empty_message_rejects_and_does_not_save(self):
        # Catches an empty message body being accepted while the toggle is on.
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True,
            domains=['example.com'],
            confirmed=True,
            send_in_app_message='on',
            in_app_message_body='',
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(
            response, 'admin/accounts/socialappcustomdata/confirmation.html'
        )
        self.assertIsNotNone(response.context['message_error'])

        self.custom_data.refresh_from_db()
        self.assertFalse(self.custom_data.managed)
        self.assertEqual(self.custom_data.domains.count(), 0)

    def test_confirmed_with_custom_message_saves(self):
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True,
            domains=['example.com'],
            confirmed=True,
            send_in_app_message='on',
            in_app_message_body='Custom message body',
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 302)
        self.custom_data.refresh_from_db()
        self.assertTrue(self.custom_data.managed)
        self.assertEqual(
            list(self.custom_data.domains.values_list('domain', flat=True)),
            ['example.com'],
        )

    def test_confirmed_with_message_toggled_off_saves_without_error(self):
        # Toggle off means no message field submitted: empty body must not block
        # the save.
        url = reverse(
            'admin:accounts_socialappcustomdata_change',
            args=[self.custom_data.pk],
        )
        post_data = self._get_change_post_data(
            managed=True, domains=['example.com'], confirmed=True
        )
        response = self.client.post(url, post_data)

        self.assertEqual(response.status_code, 302)
        self.custom_data.refresh_from_db()
        self.assertTrue(self.custom_data.managed)
        self.assertEqual(
            list(self.custom_data.domains.values_list('domain', flat=True)),
            ['example.com'],
        )
