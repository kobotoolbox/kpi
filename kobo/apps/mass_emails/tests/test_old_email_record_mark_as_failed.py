from datetime import timedelta

from constance.test import override_config
from django.utils.timezone import now
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.models import (
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
    EmailStatus
)
from kobo.apps.mass_emails.tasks import (
    mark_old_enqueued_mass_email_record_as_failed
)


class TestOldEmailRecordMarkAsFailed(TestCase):
    @override_config(PROJECT_OWNERSHIP_INVITE_EXPIRY=7)
    def test_mark_old_enqueued_mass_email_record_as_failed(self):
        """
        Test that a celery updates the status of 'enqueued' MassEmailRecord
        entries older than a specified number of days to 'failed'
        """
        email_config = MassEmailConfig.objects.create(name='testconfig')
        email_job = MassEmailJob.objects.create(email_config=email_config)

        # Create an 'enqueued' record older than the threshold date
        someuser = User.objects.create(username='someuser')
        old_email_record = MassEmailRecord.objects.create(
            user=someuser,
            email_job=email_job,
            status=EmailStatus.ENQUEUED,
            date_created=now() - timedelta(days=12)
        )

        # Create an 'enqueued' record newer than the threshold date
        anotheruser = User.objects.create(username='anotheruser')
        recent_email_record = MassEmailRecord.objects.create(
            user=anotheruser,
            email_job=email_job,
            status=EmailStatus.ENQUEUED,
            date_created=now() - timedelta(days=5)
        )

        mark_old_enqueued_mass_email_record_as_failed()

        # Ensure that the status of the old email record is updated to 'failed'
        old_email_record.refresh_from_db()
        self.assertEqual(old_email_record.status, EmailStatus.FAILED)

        # Ensure that the status of the recent email record is not updated
        recent_email_record.refresh_from_db()
        self.assertEqual(recent_email_record.status, EmailStatus.ENQUEUED)
