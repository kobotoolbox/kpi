from datetime import datetime
from unittest.mock import patch

import pytz
from django.core import mail
from django.core.cache import cache
from django.test import override_settings

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from ..models import EmailStatus, MassEmailConfig, MassEmailJob, MassEmailRecord
from ..tasks import MassEmailSender, render_template, send_emails


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
