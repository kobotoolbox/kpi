from django.core import mail

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from ..models import (
    USER_QUERIES,
    EmailStatus,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)
from ..tasks import create_job, render_template, send_emails


class TestCeleryTask(BaseTestCase):
    fixtures = ['test_data']

    def test_send_emails_task(self):
        config_A = MassEmailConfig.objects.create(
            name='Config A', subject='Subject A', template='Template'
        )
        config_B = MassEmailConfig.objects.create(
            name='Config B', subject='Subject B', template='Template'
        )
        job_A = MassEmailJob.objects.create(email_config=config_A)
        job_B = MassEmailJob.objects.create(email_config=config_B)

        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')

        MassEmailRecord.objects.create(
            user=user1, email_job=job_A, status=EmailStatus.ENQUEUED
        )
        MassEmailRecord.objects.create(
            user=user2, email_job=job_A, status=EmailStatus.SENT
        )
        MassEmailRecord.objects.create(
            user=user1, email_job=job_B, status=EmailStatus.ENQUEUED
        )
        MassEmailRecord.objects.create(
            user=user2, email_job=job_B, status=EmailStatus.ENQUEUED
        )

        send_emails(config_A.uid)
        outbox_summary = [(message.to[0], message.subject) for message in mail.outbox]
        assert (user1.email, 'Subject A') in outbox_summary
        assert (user2.email, 'Subject A') not in outbox_summary

        send_emails(config_B.uid)
        outbox_summary = [(message.to[0], message.subject) for message in mail.outbox]
        assert (user1.email, 'Subject B') in outbox_summary
        assert (user2.email, 'Subject B') in outbox_summary

        # Should not create more jobs than what we already have
        assert MassEmailJob.objects.count() == 2

    def test_create_job(self):
        config_A = MassEmailConfig.objects.create(
            name='Config A',
            subject='Subject A',
            template='Template',
            query='users_inactive_for_365_days',
        )
        create_job(config_A)
        records = MassEmailRecord.objects.all()

        expected_users = USER_QUERIES['users_inactive_for_365_days']()
        user_names = {user.username for user in expected_users}
        assert len(records) == 3
        assert user_names == {r.user.username for r in records}

    def test_send_emails_without_job(self):
        config_A = MassEmailConfig.objects.create(
            name='Config A',
            subject='Subject A',
            template='Template',
            query='users_inactive_for_365_days',
        )
        expected_users = USER_QUERIES['users_inactive_for_365_days']()
        expected_outbox = {(user.email, 'Subject A') for user in expected_users}

        send_emails(config_A.uid, should_create_job=False)
        assert MassEmailJob.objects.count() == 0

        send_emails(config_A.uid, should_create_job=True)
        assert MassEmailJob.objects.count() == 1

        outbox_summary = [(message.to[0], message.subject) for message in mail.outbox]
        assert len(outbox_summary) == 3
        assert expected_outbox == set(outbox_summary)

    def test_template_render(self):
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
