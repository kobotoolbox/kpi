from datetime import datetime, timedelta
from unittest.mock import patch

import pytz
from ddt import data, ddt, unpack
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError
from django.test import override_settings
from django.utils import timezone
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
    def test_send_emails_limits(self, now_mock):
        now_mock.return_value = datetime(2025, 1, 1, 0, 0, 0, 0, pytz.UTC)
        send_emails()
        assert len(mail.outbox) == 10
        now_mock.return_value = datetime(2025, 1, 2, 0, 0, 0, 0, pytz.UTC)
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
            username='user1', last_login=timezone.now() - timedelta(days=400)
        )
        self.user2 = User.objects.create(
            username='user2', last_login=timezone.now() - timedelta(days=400)
        )
        self.user3 = User.objects.create(
            username='user3', last_login=timezone.now() - timedelta(days=7)
        )
        self.cache_key = f'mass_emails_{timezone.now().date()}_emails'
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
            date_created=timezone.now() - timedelta(days=1),
        )

    def _create_email_record(self, user, email_config, status, days_ago=0):
        """
        Helper function to create a MassEmailRecord
        """
        record = MassEmailRecord.objects.create(
            user=user,
            email_job=MassEmailJob.objects.create(email_config=email_config),
            status=status,
            date_created=timezone.now() - timedelta(days=days_ago),
        )

        # Update date_modified to simulate record creation in the past
        MassEmailRecord.objects.filter(id=record.id).update(
            date_modified=timezone.now() - timedelta(days=days_ago)
        )

    @data(
        (EmailStatus.ENQUEUED, 1),
        (EmailStatus.SENT, 0),
        (EmailStatus.FAILED, 2),
    )
    @unpack
    def test_one_time_email_with_existing_records(self, status, enqueued_count):
        """
        Test one-time email configs (frequency=-1) behave correctly

        - If status is `ENQUEUED` or `SENT`, no new records should be created.
        - If status is `FAILED`, new records should be created.
        """
        email_config = self._create_email_config('Test')
        self._create_email_record(self.user1, email_config, status)

        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()
        records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config, status=EmailStatus.ENQUEUED
        )
        self.assertEqual(records.count(), enqueued_count)
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_one_time_email_with_no_existing_records(self):
        """
        Test that new records are created when there are no existing records
        """
        email_config = self._create_email_config('Test')
        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()

        new_records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config, status=EmailStatus.ENQUEUED
        )
        self.assertEqual(new_records.count(), 2)
        self.assertIn(email_config.id, cache.get(self.cache_key))

    @data(
        (EmailStatus.ENQUEUED, 1, 1),
        (EmailStatus.SENT, 1, 2),
        (EmailStatus.FAILED, 1, 2),
        (EmailStatus.ENQUEUED, 2, 1),
        (EmailStatus.SENT, 2, 2),
        (EmailStatus.FAILED, 2, 2),
    )
    @unpack
    def test_recurring_email_scheduling(self, status, frequency, enqueued_count):
        """
        Test that recurring email configs (frequency > 0) behave correctly
        """
        email_config = self._create_email_config(
            'Test', frequency=frequency
        )
        self._create_email_record(
            self.user1, email_config, status, days_ago=frequency
        )

        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()
        records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config, status=EmailStatus.ENQUEUED
        )
        self.assertEqual(records.count(), enqueued_count)
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_new_email_records_are_created_when_no_enqueued_emails_exist(self):
        """
        Test that new jobs and records are created when no enqueued records exist
        """
        email_config = self._create_email_config('Test')

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
        (1, 1, True, 2),
        (1, 0, False, 1),
        (2, 2, True, 2),
        (2, 1, False, 1),
        (3, 3, True, 2),
        (3, 2, False, 1),
    )
    @unpack
    def test_cutoff_date_logic(
        self, frequency, days_ago, expected_inclusion, total_records
    ):
        """
        Test that the cutoff date logic correctly determines which users should
        receive emails based on the frequency
        """
        email_config = self._create_email_config('Test', frequency=frequency)
        self._create_email_record(
            self.user1, email_config, EmailStatus.SENT, days_ago=days_ago
        )

        self.assertNotIn(email_config.id, cache.get(self.cache_key, set()))
        generate_mass_email_user_lists()

        email_job = MassEmailJob.objects.filter(
            email_config=email_config
        ).latest('date_created')
        email_records = MassEmailRecord.objects.filter(email_job=email_job)

        user_included = (
            self.user1.id in email_records.values_list('user', flat=True)
        )
        self.assertEqual(user_included, expected_inclusion)
        self.assertEqual(email_records.count(), total_records)
        self.assertIn(email_config.id, cache.get(self.cache_key))

    def test_task_skips_already_processed_configs_using_cache(self):
        """
        Test that `generate_mass_email_user_lists` uses the cached config IDs
        to skip already processed email configs
        """
        email_config1 = self._create_email_config('Test A')
        generate_mass_email_user_lists()

        self.assertIn(email_config1.id, cache.get(self.cache_key))
        config1_records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config1, status=EmailStatus.ENQUEUED
        )
        self.assertEqual(config1_records.count(), 2)

        # Delete the records to simulate reprocessing of the config
        config1_records.delete()
        self.assertEqual(
            MassEmailRecord.objects.filter(
                email_job__email_config=email_config1
            ).count(), 0
        )

        email_config2 = self._create_email_config('Test B')
        generate_mass_email_user_lists()

        self.assertIn(email_config2.id, cache.get(self.cache_key))
        records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config2, status=EmailStatus.ENQUEUED
        )
        self.assertEqual(records.count(), 2)

        # Confirm email_config1 was skipped and no new records were created
        config1_reprocessed_records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config1
        )
        self.assertEqual(config1_reprocessed_records.count(), 0)

    def test_cache_expiry(self):
        """
        Test that the cache expires after 24 hours
        """
        email_config = self._create_email_config('Test')
        generate_mass_email_user_lists()
        self.assertIn(email_config.id, cache.get(self.cache_key))

        # Simulate cache expiry by manually clearing the cache,
        # as freeze_time doesn't automatically update cache TTL
        with freeze_time(timezone.now() + timedelta(hours=24)):
            cache.clear()
            self.assertIsNone(cache.get(self.cache_key))

    def test_duplicate_entry_handling(self):
        """
        Test that duplicate email records are handled correctly
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
