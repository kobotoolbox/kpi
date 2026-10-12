from django.contrib.messages import get_messages
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.trash_bin.models.account import AccountTrash


class ExtendedUserAdminActionsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin_user = User.objects.get(username='adminuser')
        self.client.force_login(self.admin_user)
        self.url = reverse('admin:kobo_auth_user_changelist')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

    def test_mark_active(self):
        User.objects.filter(pk__in=[self.someuser.pk, self.anotheruser.pk]).update(
            is_active=False
        )

        response = self._run_action('mark_active', [self.someuser, self.anotheruser])

        assert response.status_code == 200
        self.someuser.refresh_from_db()
        self.anotheruser.refresh_from_db()
        assert self.someuser.is_active
        assert self.anotheruser.is_active
        assert '2 user(s) marked active.' in self._get_messages(response)

    def test_mark_active_only_counts_inactive_users(self):
        User.objects.filter(pk=self.someuser.pk).update(is_active=False)

        response = self._run_action('mark_active', [self.someuser, self.anotheruser])

        assert '1 user(s) marked active.' in self._get_messages(response)

    def test_mark_active_skips_users_in_trash(self):
        User.objects.filter(pk__in=[self.someuser.pk, self.anotheruser.pk]).update(
            is_active=False
        )
        AccountTrash.objects.create(
            user=self.anotheruser, request_author=self.admin_user
        )

        response = self._run_action('mark_active', [self.someuser, self.anotheruser])

        self.someuser.refresh_from_db()
        self.anotheruser.refresh_from_db()
        assert self.someuser.is_active
        assert not self.anotheruser.is_active
        messages = self._get_messages(response)
        assert '1 user(s) marked active.' in messages
        assert any('1 user(s) skipped' in message for message in messages)

    def test_mark_active_skips_removed_users(self):
        User.objects.filter(pk=self.anotheruser.pk).update(is_active=False)
        self.anotheruser.extra_details.date_removed = timezone.now()
        self.anotheruser.extra_details.save(update_fields=['date_removed'])

        response = self._run_action('mark_active', [self.anotheruser])

        self.anotheruser.refresh_from_db()
        assert not self.anotheruser.is_active
        messages = self._get_messages(response)
        assert '0 user(s) marked active.' in messages
        assert any('1 user(s) skipped' in message for message in messages)

    def test_mark_inactive(self):
        response = self._run_action('mark_inactive', [self.someuser, self.anotheruser])

        self.someuser.refresh_from_db()
        self.anotheruser.refresh_from_db()
        assert not self.someuser.is_active
        assert not self.anotheruser.is_active
        assert '2 user(s) marked inactive.' in self._get_messages(response)

    def test_actions_depend_on_is_active_filter(self):
        action_names = self._get_action_names()
        assert 'mark_active' in action_names
        assert 'mark_inactive' in action_names

        action_names = self._get_action_names('?is_active__exact=0')
        assert 'mark_active' in action_names
        assert 'mark_inactive' not in action_names

        action_names = self._get_action_names('?is_active__exact=1')
        assert 'mark_active' not in action_names
        assert 'mark_inactive' in action_names

    def test_mark_active_works_when_filtered_by_inactive_users(self):
        User.objects.filter(pk=self.someuser.pk).update(is_active=False)

        self._run_action('mark_active', [self.someuser], '?is_active__exact=0')

        self.someuser.refresh_from_db()
        assert self.someuser.is_active

    def _get_action_names(self, query_string: str = '') -> list[str]:
        response = self.client.get(f'{self.url}{query_string}')
        choices = response.context['action_form'].fields['action'].choices
        return [name for name, _ in choices]

    def _get_messages(self, response) -> list[str]:
        return [str(message) for message in get_messages(response.wsgi_request)]

    def _run_action(self, action: str, users: list, query_string: str = ''):
        return self.client.post(
            f'{self.url}{query_string}',
            {
                'action': action,
                '_selected_action': [user.pk for user in users],
            },
            follow=True,
        )
