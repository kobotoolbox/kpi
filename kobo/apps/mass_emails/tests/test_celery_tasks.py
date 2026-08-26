import random
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import pytz
from celery.exceptions import SoftTimeLimitExceeded
from constance.test import override_config
from ddt import data, ddt, unpack
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError
from django.test import override_settings
from django.utils import timezone
from freezegun import freeze_time
from model_bakery import baker
from model_bakery.recipe import seq

from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import (
    MailerConnectionSessionLimitError,
    MailerError,
    MailerProviderQuotaExhaustedError,
    MailerProviderRateThrottledError,
)
from kpi.tests.base_test_case import BaseTestCase
from ..models import EmailStatus, MassEmailConfig, MassEmailJob, MassEmailRecord
from ..tasks import (
    PROCESSED_EMAILS_CACHE_KEY,
    MassEmailSender,
    enqueue_mass_email_records,
    generate_mass_email_user_lists,
    mark_old_enqueued_mass_email_record_as_failed,
    render_template,
    send_emails,
)


def test_template_render():
    data = {
        'username': 'Test Username',
        'full_name': 'Test Full Name',
        'plan_name': 'Test Plan Name',
    }
    template = """
    Username: ##username##
    Full name: ##full_name##
    Plan name: ##plan_name##
    """
    rendered = render_template(template, data)
    assert 'Username: Test Username' in rendered
    assert 'Full name: Test Full Name' in rendered
    assert 'Plan name: Test Plan Name' in rendered


class BaseMassEmailsTestCase(BaseTestCase):
    def setUp(self):
        self.user1 = User.objects.create(
            username='user1',
            last_login=timezone.now() - timedelta(days=400),
            email='user1@test.com',
        )
        self.user2 = User.objects.create(
            username='user2',
            last_login=timezone.now() - timedelta(days=400),
            email='user2@test.com',
        )
        self.user3 = User.objects.create(
            username='user3',
            last_login=timezone.now() - timedelta(days=7),
            email='user3@test.com',
        )
        self.cache_key = PROCESSED_EMAILS_CACHE_KEY.format(
            key_date=timezone.now().date()
        )
        cache.delete(self.cache_key)

    def _create_email_config(
        self,
        name,
        template=None,
        frequency=-1,
        date_created=None,
        query='users_inactive_for_365_days',
        live=True,
    ):
        """
        Helper function to create a MassEmailConfig
        """
        date_created = date_created or timezone.now() - timedelta(days=1)
        return MassEmailConfig.objects.create(
            name=name,
            subject='Test Subject',
            template=template if template else 'Test Template',
            live=live,
            query=query,
            frequency=frequency,
            date_created=date_created,
        )

    def _create_email_record(self, user, email_config, status, days_ago=0, job=None):
        """
        Helper function to create a MassEmailRecord
        """
        if job is None:
            job = MassEmailJob.objects.create(email_config=email_config)
        record = MassEmailRecord.objects.create(
            user=user,
            email_job=job,
            status=status,
            date_created=timezone.now() - timedelta(days=days_ago),
        )

        # Update date_modified to simulate record creation in the past
        MassEmailRecord.objects.filter(id=record.id).update(
            date_modified=timezone.now() - timedelta(days=days_ago)
        )
        return record

    def _enqueue_records_for_config(self, email_config, count):
        job = MassEmailJob.objects.create(email_config=email_config)
        users = User.objects.all()
        for i in range(count):
            self._create_email_record(
                email_config=email_config,
                user=users[i],
                status=EmailStatus.ENQUEUED,
                job=job,
            )


@ddt
class TestMassEmailSender(BaseMassEmailsTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        self.template = """
        Username: ##username##
        Full name: ##full_name##
        Plan name: ##plan_name##
        """
        self.configs = []
        self.jobs = []
        cache.clear()

    def _setup_common_test_data(self):
        for i in range(0, 100):
            config = self._create_email_config(
                name=f'Config {i}', template=self.template
            )
            job = MassEmailJob.objects.create(email_config=config)
            self.configs.append(config)
            self.jobs.append(job)
            self._create_email_record(
                user=self.user1,
                email_config=config,
                job=job,
                status=EmailStatus.ENQUEUED,
            )
            self._create_email_record(
                user=self.user2,
                email_config=config,
                job=job,
                status=EmailStatus.ENQUEUED,
            )
            self._create_email_record(
                user=self.user3,
                email_config=config,
                job=job,
                status=EmailStatus.ENQUEUED,
            )

    @override_settings(MAX_MASS_EMAILS_PER_DAY=310)
    def test_daily_limits_less_than_max(self):
        self._setup_common_test_data()
        sender = MassEmailSender()
        assert sender.total_limit == 300
        assert len(sender.limits) == 100
        assert sum(sender.limits.values()) == 300

    @override_settings(MAX_MASS_EMAILS_PER_DAY=180)
    def test_daily_limits_more_than_max(self):
        self._setup_common_test_data()
        sender = MassEmailSender()
        assert sender.total_limit == 180
        assert sum(sender.limits.values()) == 180
        assert list(sender.limits.values())[0] == 2

    @override_settings(MAX_MASS_EMAILS_PER_DAY=10)
    def test_send_emails_limits(self):
        self._setup_common_test_data()
        now_mock = patch(
            'django.utils.timezone.now',
            return_value=datetime(2025, 1, 1, 0, 0, 0, 0, pytz.UTC),
        )
        now_mock.start()
        sender = MassEmailSender()
        sender.send_day_emails()
        now_mock.stop()

        assert len(mail.outbox) == 10
        now_mock = patch(
            'django.utils.timezone.now',
            return_value=datetime(2025, 1, 2, 0, 0, 0, 0, pytz.UTC),
        )
        now_mock.start()
        sender = MassEmailSender()
        sender.send_day_emails()
        assert len(mail.outbox) == 20
        # Calling send_emails on the same day:
        sender = MassEmailSender()
        sender.send_day_emails()
        assert len(mail.outbox) == 20

        # Test if limits end up with the correct value
        sender = MassEmailSender()
        assert sum([0 if lim is None else lim for lim in sender.limits.values()]) == 0
        assert sender.total_limit == 0
        now_mock.stop()

    @pytest.mark.skipif(settings.STRIPE_ENABLED, reason='Test non-stripe functionality')
    def test_get_plan_name_stripe_disabled(self):
        sender = MassEmailSender()
        plan_name = sender.get_plan_name(self.user1.organization)
        assert plan_name == 'Not available'

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=2)
    def test_send_is_throttled(self):
        # `monotonic` is pinned so every window looks fully elapsed
        # instantly, isolating the trigger pattern (every 2 sends, sleep
        # once) from real elapsed time.
        self._setup_common_test_data()
        calls = []
        with (
            patch('kobo.apps.mass_emails.tasks.monotonic', return_value=0),
            patch(
                'kobo.apps.mass_emails.tasks.sleep',
                side_effect=lambda *x: calls.append('sleep'),
            ),
            patch.object(
                MassEmailSender,
                'send_email',
                side_effect=lambda *x: calls.append('send_email'),
            ),
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

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=2.5)
    def test_send_is_throttled_below_one_per_second(self):
        # sends_per_window = floor(2.5) = 2, window_length stays clamped
        # to 1.0 (2 / 2.5 = 0.8, under the floor): 2 sends per window, not
        # the 4-per-window a shorter-than-1s window would allow.
        self._setup_common_test_data()
        calls = []
        with (
            patch('kobo.apps.mass_emails.tasks.monotonic', return_value=0),
            patch(
                'kobo.apps.mass_emails.tasks.sleep',
                side_effect=lambda *x: calls.append('sleep'),
            ),
            patch.object(
                MassEmailSender,
                'send_email',
                side_effect=lambda *x: calls.append('send_email'),
            ),
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

    @override_settings(MASS_EMAIL_THROTTLE_PER_SECOND=0.5)
    def test_send_is_throttled_above_one_second_per_send(self):
        # A budget under 1/s can't be enforced within a single second, so
        # the window widens instead of rounding the achieved rate up to
        # 1/s: one send per 2-second window here.
        self._setup_common_test_data()
        calls = []
        with (
            patch('kobo.apps.mass_emails.tasks.monotonic', return_value=0),
            patch(
                'kobo.apps.mass_emails.tasks.sleep',
                side_effect=lambda *x: calls.append('sleep'),
            ),
            patch.object(
                MassEmailSender,
                'send_email',
                side_effect=lambda *x: calls.append('send_email'),
            ),
        ):
            sender = MassEmailSender()
            sender.limits = {self.configs[0].id: 3, self.configs[1].id: 2}
            sender.send_day_emails()
        assert calls == [
            'send_email',
            'sleep',
            'send_email',
            'sleep',
            'send_email',
            'sleep',
            'send_email',
            'sleep',
            'send_email',
        ]

    @override_settings(MASS_EMAILS_CONDENSE_SEND=True)
    @data((5, 0), (20, 15), (40, 30), (46, 45))
    @unpack
    def test_cache_key_date_condensed_send_interval(
        self, current_minute, expected_minute
    ):
        current_time = datetime(
            year=2025, month=1, day=1, hour=1, minute=current_minute
        )
        expected_time = datetime(
            year=2025, month=1, day=1, hour=1, minute=expected_minute
        )
        assert (
            MassEmailSender.get_cache_key_date(send_date=current_time) == expected_time
        )

    def test_send_recurring_emails_exits_when_incomplete_init(self):
        self._setup_common_test_data()
        send_emails()
        assert len(mail.outbox) == 0

    def test_send_emails_stops_gracefully_on_soft_time_limit(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_day_emails',
            side_effect=SoftTimeLimitExceeded,
        ):
            # The task must swallow the soft time limit itself rather than
            # surfacing as a task failure: it is an expected outcome of a
            # capped, resumable run.
            send_emails()
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).exists()

    def test_send_emails_stops_gracefully_on_quota_exhausted(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_day_emails',
            side_effect=MailerProviderQuotaExhaustedError('quota gone'),
        ):
            # Same as the soft time limit above: an expected, resumable stop,
            # not a task failure.
            send_emails()
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).exists()

    def test_send_emails_stops_gracefully_on_rate_throttled(self):
        # TODO(DEV-2693): currently the same treatment as quota-exhausted.
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_day_emails',
            side_effect=MailerProviderRateThrottledError('slow down'),
        ):
            send_emails()
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).exists()

    def test_soft_time_limit_does_not_decrement_the_interrupted_record_s_quota(self):
        # The record that triggered the interrupt was never actually sent, so
        # the daily budget it was about to claim must not be spent on it:
        # otherwise a resumable interruption quietly wastes quota.
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_email',
            side_effect=SoftTimeLimitExceeded,
        ):
            send_emails()

        sender = MassEmailSender()
        assert sum(sender.limits.values()) == 300
        assert sender.total_limit == 300

    def test_quota_exhausted_does_not_decrement_the_interrupted_record_s_quota(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_email',
            side_effect=MailerProviderQuotaExhaustedError('quota gone'),
        ):
            send_emails()

        sender = MassEmailSender()
        assert sum(sender.limits.values()) == 300
        assert sender.total_limit == 300

    def test_rate_throttled_does_not_decrement_the_interrupted_record_s_quota(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        with patch(
            'kobo.apps.mass_emails.tasks.MassEmailSender.send_email',
            side_effect=MailerProviderRateThrottledError('slow down'),
        ):
            send_emails()

        sender = MassEmailSender()
        assert sum(sender.limits.values()) == 300
        assert sender.total_limit == 300

    @override_settings(MAX_MASS_EMAILS_PER_DAY=100)
    def test_send_recurring_emails_when_initialized(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        send_emails()
        assert len(mail.outbox) == 100

    @override_settings(MAX_MASS_EMAILS_PER_DAY=100)
    def test_send_recurring_emails_after_config_is_canceled(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        # pretend a user set one of the configs to be no longer live
        email_config = MassEmailConfig.objects.first()
        email_config.live = False
        email_config.save()

        send_emails()
        assert len(mail.outbox) == 100

    @override_settings(MAX_MASS_EMAILS_PER_DAY=100)
    def test_send_recurring_emails_after_config_is_added(self):
        self._setup_common_test_data()
        generate_mass_email_user_lists()
        # pretend a user created a new config
        self._create_email_config(
            name='new config', template=self.template, date_created=timezone.now()
        )
        send_emails()
        assert len(mail.outbox) == 100

    @data(
        # max emails per day, expected limits for one-time emails 1 and 2
        (20, 2, 8),
        (15, 1, 4),
        (40, 5, 20),
        (10, 0, 0),
    )
    @unpack
    def test_one_time_emails_deprioritized(
        self, max_per_day, expected_limit_1, expected_limit_2
    ):
        # make sure we have at least 20 users
        total_users = User.objects.count()
        if total_users < 20:
            remaining = 20 - total_users
            baker.make(User, username=seq('User'), _quantity=remaining)

        # create 1 recurring email (ie frequency > -1) with 10 enqueued records
        recurring_config = self._create_email_config(
            name='Recurring config',
            template=self.template,
            frequency=random.randint(0, 10),
        )
        self._enqueue_records_for_config(email_config=recurring_config, count=10)

        # create 1 one-time email to send to 5 users
        recurring_config_1 = self._create_email_config(
            name='One-time config 5 enqueued', template=self.template, frequency=-1
        )
        self._enqueue_records_for_config(email_config=recurring_config_1, count=5)

        # create 1 one-time email to send to 20 users
        recurring_config_2 = self._create_email_config(
            name='One-time config 20 enqueued', template=self.template, frequency=-1
        )
        self._enqueue_records_for_config(email_config=recurring_config_2, count=20)

        with override_settings(MAX_MASS_EMAILS_PER_DAY=max_per_day):
            sender = MassEmailSender()

        # all max_per_day options are > 10,
        # so the recurring emails should send all its emails
        assert sender.limits[recurring_config.id] == 10

        assert sender.limits.get(recurring_config_1.id, 0) == expected_limit_1
        assert sender.limits.get(recurring_config_2.id, 0) == expected_limit_2

    @override_config(MASS_EMAIL_TEST_EMAILS='test@example.com')
    def test_one_time_emails_only_turned_off_after_sent(self):
        User.objects.create_user(username='test', email='test@example.com')
        config_1 = self._create_email_config(
            name='test', frequency=-1, query='test_users'
        )
        generate_mass_email_user_lists()
        # config 2 is created after the daily list is generated
        config_2 = self._create_email_config(
            name='second test', frequency=-1, query='test_users'
        )

        # we will only have generated records for config_1, nothing should change
        config_1.refresh_from_db()
        assert config_1.live
        assert config_2.live

        send_emails()
        # we have now sent emails for config_1, so it should no longer be live
        # config_2 should still be live
        config_1.refresh_from_db()
        config_2.refresh_from_db()
        assert config_2.live
        assert not config_1.live

        # next day, new email lists generated
        with freeze_time(timezone.now() + timedelta(days=1)):
            generate_mass_email_user_lists()
            send_emails()
        config_2.refresh_from_db()
        config_1.refresh_from_db()
        # both emails were sent, both are no longer live
        assert not config_1.live
        assert not config_2.live


class TestStaleRecordRevalidation(BaseMassEmailsTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        cache.clear()
        self.template = 'Username: ##username##'
        self.email_config = self._create_email_config(
            name='Stale config', template=self.template
        )

    def test_stale_ineligible_record_is_marked_stale(self):
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=1,
        )
        with patch.object(
            MassEmailConfig, 'is_user_still_eligible', return_value=False
        ) as mock_check:
            sender = MassEmailSender()
            sender.send_day_emails()

        mock_check.assert_called_once()
        assert len(mail.outbox) == 0
        record = MassEmailRecord.objects.get(user=self.user1)
        assert record.status == EmailStatus.STALE

    def test_stale_still_eligible_record_is_sent_normally(self):
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=1,
        )
        with patch.object(
            MassEmailConfig, 'is_user_still_eligible', return_value=True
        ) as mock_check:
            sender = MassEmailSender()
            sender.send_day_emails()

        mock_check.assert_called_once()
        assert len(mail.outbox) == 1
        record = MassEmailRecord.objects.get(user=self.user1)
        assert record.status == EmailStatus.SENT

    def test_fresh_record_is_sent_without_reevaluating_the_query(self):
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=0,
        )
        with patch.object(
            MassEmailConfig, 'is_user_still_eligible', return_value=True
        ) as mock_check:
            sender = MassEmailSender()
            sender.send_day_emails()

        mock_check.assert_called_once_with(self.user1, reevaluate_query=False)
        assert len(mail.outbox) == 1
        record = MassEmailRecord.objects.get(user=self.user1)
        assert record.status == EmailStatus.SENT

    @override_config(MASS_EMAIL_STALE_RECORD_RECHECK_HOURS=1)
    def test_recheck_threshold_is_read_from_constance(self):
        # 2h old: not stale against the 12h default, but stale against the
        # 1h threshold set here, proving the value is read live and not
        # baked in at import time
        job = MassEmailJob.objects.create(email_config=self.email_config)
        MassEmailRecord.objects.create(
            user=self.user1,
            email_job=job,
            status=EmailStatus.ENQUEUED,
            date_created=timezone.now() - timedelta(hours=2),
        )
        with patch.object(
            MassEmailConfig, 'is_user_still_eligible', return_value=False
        ) as mock_check:
            sender = MassEmailSender()
            sender.send_day_emails()

        mock_check.assert_called_once()
        record = MassEmailRecord.objects.get(user=self.user1)
        assert record.status == EmailStatus.STALE

    def test_stale_record_does_not_consume_pacer_budget(self):
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=1,
        )
        self._create_email_record(
            user=self.user2,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=0,
        )
        with patch.object(
            MassEmailConfig,
            'is_user_still_eligible',
            side_effect=lambda user, reevaluate_query=True: not reevaluate_query,
        ):
            sender = MassEmailSender()
            original_limit = sender.limits[self.email_config.id]
            sender.send_day_emails()

        # only user2's fresh record was actually sent
        assert len(mail.outbox) == 1

        # both records are now processed, so the config drops out of a fresh
        # MassEmailSender's `.limits` entirely (0 enqueued left); read the
        # cached remaining budget directly instead
        remaining = cache.get(f'{sender.cache_key_prefix}_{self.email_config.id}')
        assert remaining == original_limit - 1

    @override_settings(MAX_MASS_EMAILS_PER_DAY=2)
    def test_stale_records_do_not_shrink_the_days_effective_capacity(self):
        # Stale records created first, fresh ones after: with a plain
        # `[:limit]` slice, the two stale records alone would fill the
        # window and leave the fresh, eligible ones enqueued despite spare
        # capacity. The fix must pull past them instead.
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=1,
        )
        self._create_email_record(
            user=self.user2,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=1,
        )
        self._create_email_record(
            user=self.user3,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=0,
        )
        user4 = User.objects.create(username='user4', email='user4@test.com')
        self._create_email_record(
            user=user4,
            email_config=self.email_config,
            status=EmailStatus.ENQUEUED,
            days_ago=0,
        )

        with patch.object(
            MassEmailConfig,
            'is_user_still_eligible',
            side_effect=lambda user, reevaluate_query=True: not reevaluate_query,
        ):
            sender = MassEmailSender()
            assert sender.limits[self.email_config.id] == 2
            sender.send_day_emails()

        assert len(mail.outbox) == 2
        statuses = list(
            MassEmailRecord.objects.filter(
                email_job__email_config=self.email_config
            ).values_list('status', flat=True)
        )
        assert statuses.count(EmailStatus.STALE) == 2
        assert statuses.count(EmailStatus.SENT) == 2
        assert not MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).exists()

    def test_mark_old_enqueued_record_as_failed_ignores_stale_records(self):
        self._create_email_record(
            user=self.user1,
            email_config=self.email_config,
            status=EmailStatus.STALE,
            days_ago=30,
        )
        mark_old_enqueued_mass_email_record_as_failed()
        record = MassEmailRecord.objects.get(user=self.user1)
        assert record.status == EmailStatus.STALE


@ddt
class GenerateDailyEmailUserListTaskTestCase(BaseMassEmailsTestCase):

    @data(
        (EmailStatus.ENQUEUED, -1, 1),
        (EmailStatus.SENT, -1, 2),
        (EmailStatus.FAILED, -1, 2),
        (EmailStatus.ENQUEUED, 2, 1),
        (EmailStatus.SENT, 2, 2),
        (EmailStatus.FAILED, 2, 2),
    )
    @unpack
    def test_recurring_email_scheduling(self, status, frequency, enqueued_count):
        """
        Test we don't enqueue records if there are already pending ones
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

    def test_enqueue_creates_records_via_id_path(self):
        """
        enqueue_mass_email_records builds records from user ids (not User
        instances) and stores one enqueued row per recipient.
        """
        email_config = self._create_email_config('Test')

        enqueue_mass_email_records(email_config)

        job = MassEmailJob.objects.filter(email_config=email_config).latest(
            'date_created'
        )
        records = MassEmailRecord.objects.filter(email_job=job)
        self.assertEqual(records.count(), 2)
        self.assertEqual(
            set(records.values_list('user_id', flat=True)),
            {self.user1.id, self.user2.id},
        )
        self.assertTrue(
            all(record.status == EmailStatus.ENQUEUED for record in records)
        )

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

    @override_config(MASS_EMAIL_TEST_EMAILS='')
    def test_one_off_emails_turned_off_if_no_recipients(self):
        email_config = self._create_email_config('Test')
        email_config.query = 'test_users'
        email_config.save()
        generate_mass_email_user_lists()
        email_config.refresh_from_db()
        assert not email_config.live


class TestMassEmailSenderConnection(BaseMassEmailsTestCase):
    """
    Cover how a send run handles its SMTP connection, and how it reacts to
    what `Mailer.send()` raises. The connection reset/retry mechanics
    themselves live in `Mailer.send()` and are covered in
    `kpi/tests/test_mailer.py` - these tests only cover what this layer is
    responsible for: record status and run control flow.
    """

    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        cache.clear()
        config = self._create_email_config(name='Config')
        job = MassEmailJob.objects.create(email_config=config)
        for user in (self.user1, self.user2, self.user3):
            self._create_email_record(
                user=user,
                email_config=config,
                job=job,
                status=EmailStatus.ENQUEUED,
            )

    def test_a_single_connection_is_reused_across_records(self):
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send', return_value=None
            ) as send_mock,
        ):
            MassEmailSender().send_day_emails()

        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 3
        # One handshake for the whole run rather than one per record
        assert connection.open.call_count == 1
        assert connection.close.call_count == 1
        # Every message travels on that one connection. Without this, a message
        # falls back to `send_mail()` opening its own connection.
        assert send_mock.call_count == 3
        for call in send_mock.call_args_list:
            assert call.kwargs['connection'] is connection

    def test_deactivated_user_record_is_marked_stale_and_not_sent(self):
        # A user deactivated after enqueue must not receive the email; their
        # record is marked stale up front by MassEmailSender.__init__
        self.user1.is_active = False
        self.user1.save()
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send', return_value=None
            ) as send_mock,
        ):
            MassEmailSender().send_day_emails()

        user1_record = MassEmailRecord.objects.get(user=self.user1)
        assert user1_record.status == EmailStatus.STALE
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 2
        sent_recipients = [call.args[0].to for call in send_mock.call_args_list]
        assert self.user1.email not in sent_recipients

    def test_orphaned_record_is_marked_stale_and_not_sent(self):
        # Records whose user was deleted can never be sent; mark them stale
        # so one-time configs still terminate
        record = MassEmailRecord.objects.get(user=self.user1)
        record.user = None
        record.save()
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch('kobo.apps.mass_emails.tasks.Mailer.send', return_value=None),
        ):
            MassEmailSender().send_day_emails()

        record.refresh_from_db()
        assert record.status == EmailStatus.STALE
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 2

    def test_user_deactivated_mid_run_is_marked_stale_and_not_sent(self):
        # The sender reads its batch (and runs its eager cleanup) while the
        # user is still active, then the user is deactivated before their
        # record is reached. The per-record guard catches it even though the
        # record is far too young for the stale-threshold recheck.
        sender = MassEmailSender()
        self.user1.is_active = False
        self.user1.save()
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send', return_value=None
            ) as send_mock,
        ):
            sender.send_day_emails()

        user1_record = MassEmailRecord.objects.get(user=self.user1)
        assert user1_record.status == EmailStatus.STALE
        sent_recipients = [call.args[0].to for call in send_mock.call_args_list]
        assert self.user1.email not in sent_recipients

    def test_mailer_error_marks_the_record_failed_and_the_run_continues(self):
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send',
                side_effect=[MailerError('mailbox unavailable'), None, None],
            ) as send_mock,
        ):
            MassEmailSender().send_day_emails()

        assert send_mock.call_count == 3
        assert MassEmailRecord.objects.filter(status=EmailStatus.FAILED).count() == 1
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 2

    def test_rate_throttled_error_stops_the_run_immediately(self):
        # TODO(DEV-2693): this currently matches quota-exhausted exactly -
        # no blocking sleep fits inside the task's soft time limit. See the
        # docstring on MailerProviderRateThrottledError.
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send',
                side_effect=[None, MailerProviderRateThrottledError('slow down')],
            ) as send_mock,
            pytest.raises(MailerProviderRateThrottledError),
        ):
            MassEmailSender().send_day_emails()

        assert send_mock.call_count == 2
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 1
        # The throttled record, and the one never reached, stay enqueued
        # rather than being written off as failed
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).count() == 2

    def test_quota_exhausted_error_stops_the_run_immediately(self):
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send',
                side_effect=[None, MailerProviderQuotaExhaustedError('quota gone')],
            ) as send_mock,
            pytest.raises(MailerProviderQuotaExhaustedError),
        ):
            MassEmailSender().send_day_emails()

        assert send_mock.call_count == 2
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 1
        # The record that hit the quota error, and the one never reached,
        # stay enqueued rather than being written off as failed
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).count() == 2

    def test_connection_session_limit_error_skips_the_record_and_continues(self):
        # Unlike rate-throttled/quota-exhausted, this must not stop the run:
        # the connection is already reconnected by the time Mailer.send()
        # raises it, so the next record should be attempted right away.
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send',
                side_effect=[
                    None,
                    MailerConnectionSessionLimitError('session limit reached'),
                    None,
                ],
            ) as send_mock,
        ):
            sender = MassEmailSender()
            email_config = MassEmailConfig.objects.get(name='Config')
            original_limit = sender.limits[email_config.id]
            sender.send_day_emails()

        assert send_mock.call_count == 3
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 2
        assert MassEmailRecord.objects.filter(status=EmailStatus.FAILED).count() == 0
        # stays enqueued for a later run, not written off as failed
        assert (
            MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).count() == 1
        )
        # only the 2 real sends spend budget, not the skipped one
        remaining = cache.get(f'{sender.cache_key_prefix}_{email_config.id}')
        assert remaining == original_limit - 2

    def test_soft_time_limit_closes_the_connection_and_leaves_records_enqueued(self):
        connection = MagicMock()
        with (
            patch('kpi.utils.mailer.get_connection', return_value=connection),
            patch(
                'kobo.apps.mass_emails.tasks.Mailer.send',
                side_effect=[None, SoftTimeLimitExceeded()],
            ) as send_mock,
            pytest.raises(SoftTimeLimitExceeded),
        ):
            MassEmailSender().send_day_emails()

        # `with_smtp_connection`'s `finally` still runs: the connection is not
        # left dangling even though the run was interrupted
        assert connection.close.call_count == 1
        assert send_mock.call_count == 2
        # The interrupted record, and the one never reached, stay enqueued
        # rather than being written off as failed
        assert MassEmailRecord.objects.filter(status=EmailStatus.SENT).count() == 1
        assert MassEmailRecord.objects.filter(status=EmailStatus.ENQUEUED).count() == 2


class TestMarkOldRecordsAsFailed(BaseMassEmailsTestCase):

    @override_config(MASS_EMAIL_ENQUEUED_RECORD_EXPIRY=5)
    def test_mark_old_records_as_failed_expires_old_records(self):
        config = self._create_email_config(name='test')
        record_old = self._create_email_record(
            user=self.user1, days_ago=10, status='enqueued', email_config=config
        )
        record_new = self._create_email_record(
            user=self.user1, days_ago=3, status='enqueued', email_config=config
        )

        mark_old_enqueued_mass_email_record_as_failed()
        record_old.refresh_from_db()
        record_new.refresh_from_db()
        assert record_old.status == 'failed'
        assert record_new.status == 'enqueued'

    @override_config(MASS_EMAIL_ENQUEUED_RECORD_EXPIRY=5)
    def test_mark_old_records_as_failed_disables_failed_oneoff_sends(self):
        config_to_expire = self._create_email_config(
            name='test', frequency=-1, live=True
        )
        config_to_keep = self._create_email_config(
            name='test2', frequency=-1, live=True
        )

        # create 2 old records for config_to_expire
        self._create_email_record(
            user=self.user1,
            status='enqueued',
            email_config=config_to_expire,
            days_ago=10,
        )
        self._create_email_record(
            user=self.user2,
            status='enqueued',
            email_config=config_to_expire,
            days_ago=10,
        )

        # create 1 old record and 1 newer for config_to_keep
        self._create_email_record(
            user=self.user1, status='enqueued', email_config=config_to_keep, days_ago=10
        )
        self._create_email_record(
            user=self.user2, status='enqueued', email_config=config_to_keep, days_ago=3
        )

        mark_old_enqueued_mass_email_record_as_failed()
        config_to_expire.refresh_from_db()
        config_to_keep.refresh_from_db()
        assert not config_to_expire.live
        assert config_to_keep.live
