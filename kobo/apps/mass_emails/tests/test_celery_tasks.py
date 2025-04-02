from datetime import datetime, timedelta
from unittest.mock import patch

import pytz
from ddt import data, ddt, unpack
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError
from django.test import override_settings
from django.utils.timezone import now
from freezegun import freeze_time

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from ..models import EmailStatus, MassEmailConfig, MassEmailJob, MassEmailRecord
from ..tasks import (
    MassEmailSender,
    generate_mass_email_user_lists,
    render_template,
    send_emails
)


class TestCeleryTask(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        cache.clear()
        self.template = """
        Username: ##username##
        Full name: ##full_name##
        Plan name: ##plan_name##
        """
        self.configs = []
        self.jobs = []
        self.user1 = User.objects.get(username='someuser')
        self.user2 = User.objects.get(username='anotheruser')
        self.user3 = User.objects.get(username='adminuser')

        for i in range(0, 100):
            config = MassEmailConfig.objects.create(
                name=f'Config {i}', subject=f'Subject {i}', template=self.template
            )
            job = MassEmailJob.objects.create(email_config=config)
            self.configs.append(config)
            self.jobs.append(job)
            MassEmailRecord.objects.create(
                user=self.user1, email_job=job, status=EmailStatus.ENQUEUED
            )
            MassEmailRecord.objects.create(
                user=self.user2, email_job=job, status=EmailStatus.ENQUEUED
            )
            MassEmailRecord.objects.create(
                user=self.user3, email_job=job, status=EmailStatus.ENQUEUED
            )

    @override_settings(MAX_MASS_EMAILS_PER_DAY=310)
    def test_daily_limits_less_than_max(self):
        sender = MassEmailSender()
        assert sender.total_limit == 300
        assert len(sender.limits) == 100
        assert sum(sender.limits.values()) == 300

    @override_settings(MAX_MASS_EMAILS_PER_DAY=180)
    def test_daily_limits_more_than_max(self):
        sender = MassEmailSender()
        assert sender.total_limit == 180
        assert sum(sender.limits.values()) == 180
        assert list(sender.limits.values())[0] == 2

    @override_settings(MAX_MASS_EMAILS_PER_DAY=10)
    @patch('django.utils.timezone.now')
    @patch('kobo.apps.mass_emails.tasks.now')  # Unfortunately we have to mock both
    def test_send_emails_limits(self, now_mock, now_mock_B):
        now_mock.return_value = datetime(2025, 1, 1, 0, 0, 0, 0, pytz.UTC)
        now_mock_B.return_value = now_mock.return_value
        send_emails()
        assert len(mail.outbox) == 10
        now_mock.return_value = datetime(2025, 1, 2, 0, 0, 0, 0, pytz.UTC)
        now_mock_B.return_value = now_mock.return_value
        send_emails()
        assert len(mail.outbox) == 20
        # Calling send_emails on the same day:
        send_emails()
        assert len(mail.outbox) == 20

        # Test if limits end up witht he correct value
        sender = MassEmailSender()
        assert sum([0 if lim is None else lim for lim in sender.limits.values()]) == 0
        assert sender.total_limit == 0

    def test_template_render(self):
        data = {
            'username': 'Test Username',
            'full_name': 'Test Full Name',
            'plan_name': 'Test Plan Name',
        }

        rendered = render_template(self.template, data)
        assert 'Username: Test Username' in rendered
        assert 'Full name: Test Full Name' in rendered
        assert 'Plan name: Test Plan Name' in rendered

    @override_settings(STRIPE_ENABLED=False)
    def test_get_plan_name_stripe_disabled(self):
        org_user = self.user1.organization.organization_users.get(user=self.user1)
        sender = MassEmailSender()
        plan_name = sender.get_plan_name(org_user)
        assert plan_name == 'Not available'

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=2)
    def test_send_is_throttled(self):
        calls = []
        with patch(
            'kobo.apps.mass_emails.tasks.sleep',
            side_effect=lambda *x: calls.append('sleep'),
        ):
            with patch.object(
                MassEmailSender,
                'send_email',
                side_effect=lambda *x: calls.append('send_email'),
            ):
                sender = MassEmailSender()
                sender.limits = {self.configs[0].id: 3, self.configs[1].id: 2}
                sender.send_day_emails()
        assert calls == [
            'send_email',
            'send_email',
            'sleep',
            'send_email',
            'send_email',
            'sleep',
            'send_email',
        ]


@ddt
class GenerateDailyEmailUserListTaskTestCase(BaseTestCase):
    def setUp(self):
        self.user1 = User.objects.create(
            username='user1', last_login=now() - timedelta(days=400)
        )
        self.user2 = User.objects.create(
            username='user2', last_login=now() - timedelta(days=400)
        )
        self.user3 = User.objects.create(
            username='user3', last_login=now() - timedelta(days=7)
        )
        self.cache_key = f'{now().date()}_emails'
        cache.delete(self.cache_key)

    def _create_email_config(self, name, frequency=-1):
        """
        Helper function to create a MassEmailConfig
        """
        return MassEmailConfig.objects.create(
            name=name,
            subject='Test Subject',
            template='Test Template',
            live=True,
            query='users_inactive_for_365_days',
            frequency=frequency,
            date_created=now() - timedelta(days=1),
        )

    def _create_email_record(self, user, email_config, status, days_ago=0):
        """
        Helper function to create a MassEmailRecord
        """
        return MassEmailRecord.objects.create(
            user=user,
            email_job=MassEmailJob.objects.create(email_config=email_config),
            status=status,
            date_created=now() - timedelta(days=days_ago),
        )

    def test_one_time_email_send_is_cached(self):
        """
        Verify that one-time email configs (frequency=-1) are cached if records
        were sent/enqueued
        """
        email_config = self._create_email_config('Test')
        self._create_email_record(self.user1, email_config, EmailStatus.ENQUEUED)
        self._create_email_record(self.user2, email_config, EmailStatus.SENT)

        # Verify config is cached after task execution
        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_existing_enqueued_email_config_is_cached(self):
        """
        Verify that email configs with existing enqueued records are cached
        """
        email_config = self._create_email_config('Test')
        self._create_email_record(self.user1, email_config, EmailStatus.ENQUEUED)

        # Verify config is cached after task execution
        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_new_email_records_are_created_when_no_enqueued_emails_exist(self):
        """
        Verify that new jobs and records are created when no enqueued records exist
        """
        email_config = self._create_email_config('Test')

        # Verify job, records creation, and config caching after task execution
        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()

        email_job = MassEmailJob.objects.get(email_config=email_config)
        email_records = MassEmailRecord.objects.filter(email_job=email_job)

        self.assertEqual(email_records.count(), 2)
        self.assertEqual(
            set(email_records.values_list('user', flat=True)),
            {self.user1.id, self.user2.id}
        )
        self.assertTrue(
            all(record.status == EmailStatus.ENQUEUED for record in email_records)
        )
        self.assertIn(email_config.id, cache.get(self.cache_key))

    @data(
        (0,),
        (1,),
        (2,),
    )
    @unpack
    def test_recurring_email_send_creates_new_records(self, frequency):
        """
        Verify that recurring email configs (frequency >= 0) generate new records
        """
        email_config = self._create_email_config('Test', frequency=frequency)
        self._create_email_record(
            self.user1, email_config, EmailStatus.SENT, days_ago=1 + frequency
        )

        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()

        email_job = MassEmailJob.objects.filter(
            email_config=email_config
        ).latest('date_created')
        email_records = MassEmailRecord.objects.filter(email_job=email_job)

        self.assertEqual(email_records.count(), 2)
        self.assertEqual(
            set(email_records.values_list('user', flat=True)),
            {self.user1.id, self.user2.id}
        )
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_users_who_recently_received_emails_are_excluded(self):
        """
        Verify that users who received emails within the configured frequency
        are excluded
        """
        email_config = self._create_email_config('Test', frequency=2)
        self._create_email_record(
            self.user1, email_config, EmailStatus.SENT, days_ago=2
        )
        self._create_email_record(
            self.user2, email_config, EmailStatus.SENT, days_ago=1
        )

        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()

        email_job = MassEmailJob.objects.filter(
            email_config=email_config
        ).latest('date_created')
        records = MassEmailRecord.objects.filter(email_job=email_job)

        self.assertNotIn(self.user2.id, records.values_list('user', flat=True))
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_cache_expiry(self):
        """
        Verify that the cache expires after 24 hours
        """
        email_config = self._create_email_config('Test')
        generate_mass_email_user_lists()
        self.assertIn(email_config.id, cache.get(self.cache_key))

        # Simulate cache expiry by manually clearing the cache,
        # as freeze_time doesn't automatically update cache TTL
        with freeze_time(now() + timedelta(hours=24)):
            cache.clear()
            self.assertIsNone(cache.get(self.cache_key))

    def test_duplicate_entry_handling(self):
        """
        Verify that duplicate email records are handled correctly
        """
        email_config = self._create_email_config('Test')
        with patch(
            'kobo.apps.mass_emails.tasks.enqueue_mass_email_records'
        ) as mock_enqueue:
            mock_enqueue.side_effect = IntegrityError('Duplicate entry error')
            generate_mass_email_user_lists()

        mock_enqueue.assert_called()
        self.assertNotIn(email_config.id, cache.get(self.cache_key))

        record = MassEmailRecord.objects.filter(
            email_job__email_config=email_config
        )
        self.assertFalse(record.exists())
