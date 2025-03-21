from datetime import timedelta

from django.contrib.messages import get_messages
from django.contrib.admin.sites import site
from django.test import TestCase
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.admin import MassEmailConfigAdmin
from kobo.apps.mass_emails.models import (
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
    EmailStatus
)


class EnqueueMassEmailRecordsTestCase(TestCase):
    """
    Tests for creating mass email records and jobs via the admin action
    """
    def setUp(self):
        self.email_config = MassEmailConfig.objects.create(
            name='Test Config',
            subject='Test Subject',
            template='Test Template',
            query='users_inactive_for_365_days',
        )

        self.user = User.objects.create(
            username='testuser',
            last_login=now() - timedelta(days=400),
        )

    def test_admin_action_enqueues_mass_email_records(self):
        """
        Test that selecting 'Add to daily send queue' in the admin enqueues
        mass email records for the specified email config
        """
        # Ensure no jobs or records exist before the task is scheduled
        self.assertEqual(MassEmailJob.objects.count(), 0)
        self.assertEqual(MassEmailRecord.objects.count(), 0)

        # Attempt to enqueue the records via the admin action
        admin_instance = MassEmailConfigAdmin(MassEmailConfig, site)
        request = self.client.request().wsgi_request
        queryset = MassEmailConfig.objects.filter(id=self.email_config.id)
        admin_instance.enqueue_mass_emails(request, queryset)

        # Verify that the task was scheduled and the records were created
        self.assertEqual(MassEmailJob.objects.count(), 1)
        self.assertEqual(MassEmailRecord.objects.count(), 1)
        self.assertEqual(MassEmailRecord.objects.first().user, self.user)

    def test_admin_action_prevents_duplicate_enqueues_of_same_config(self):
        """
        Test that selecting 'Add to daily send queue' in the admin prevents
        duplicate enqueues of the same email config
        """
        # Create a job and enqueued record for the config
        job = MassEmailJob.objects.create(email_config=self.email_config)
        MassEmailRecord.objects.create(
            user=self.user, email_job=job, status=EmailStatus.ENQUEUED
        )

        # Attempt to enqueue the records with the same config via the admin action
        admin_instance = MassEmailConfigAdmin(MassEmailConfig, site)
        request = self.client.request().wsgi_request
        queryset = MassEmailConfig.objects.filter(id=self.email_config.id)
        admin_instance.enqueue_mass_emails(request, queryset)

        # Verify that the error message appears in Django's message storage
        messages_list = [m.message for m in get_messages(request)]
        expected_message = (f'Emails for {self.email_config.name} are already '
                            f'enqueued or being sent')
        assert expected_message in messages_list
