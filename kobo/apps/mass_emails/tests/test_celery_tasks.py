from django.core import mail

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from ..models import EmailStatus, MassEmailConfig, MassEmailJob, MassEmailRecord
from ..tasks import send_emails


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

        send_emails()

        outbox_summary = [(message.to, message.subject) for message in mail.outbox]
        assert ([user1.email], 'Subject A') in outbox_summary
        assert ([user2.email], 'Subject A') not in outbox_summary
        assert ([user1.email], 'Subject B') in outbox_summary
        assert ([user2.email], 'Subject B') in outbox_summary
