from ddt import data, ddt, unpack
from django.contrib.admin.sites import site
from django.contrib.messages import get_messages
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.admin import MassEmailConfigAdmin
from kobo.apps.mass_emails.models import (
    EmailStatus,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)


@ddt
class AdminTestCase(TestCase):
    """
    Tests for turning on mass emails via the admin action
    """

    fixtures = ['test_data']

    def _add_to_send(self, email_config):
        admin_instance = MassEmailConfigAdmin(MassEmailConfig, site)
        request = self.client.request().wsgi_request
        queryset = MassEmailConfig.objects.filter(id=email_config.id)
        admin_instance.enqueue_mass_emails(request, queryset)
        email_config.refresh_from_db()
        return request

    @data(
        # frequency, is_live, expected_message_template
        (
            1,
            False,
            'Emails for {config} have been added to the daily send',
        ),
        (1, True, 'Emails for {config} are already part of the daily send'),
        (
            -1,
            False,
            'Emails for {config} have been scheduled for tomorrow',
        ),
        (
            -1,
            True,
            'Emails for {config} have already been scheduled',
        ),
    )
    @unpack
    def test_admin_action(self, frequency, is_live, expected_message):
        """
        Test that selecting 'Add to daily send queue' in the admin
        sets the config to live or delivers an appropriate error
        """
        email_config = MassEmailConfig.objects.create(
            name='Test Config',
            subject='Test Subject',
            template='Test Template',
            query='users_inactive_for_365_days',
            frequency=frequency,
            live=is_live,
        )

        # Attempt to enqueue the records via the admin action
        request = self._add_to_send(email_config)
        expected_message = expected_message.format(config=email_config.name)

        messages_list = [m.message for m in get_messages(request)]
        assert expected_message in messages_list
        assert email_config.live

    def test_live_disabled_when_oneoff_is_enqueued(self):
        email_config = MassEmailConfig.objects.create(
            name='Test Config',
            subject='Test Subject',
            template='Test Template',
            query='users_inactive_for_365_days',
            frequency=-1,
            live=True,
        )
        admin_instance = MassEmailConfigAdmin(MassEmailConfig, site)
        request = self.client.request().wsgi_request
        job = MassEmailJob.objects.create(email_config=email_config)
        MassEmailRecord.objects.create(
            email_job=job, user=User.objects.get(pk=1), status=EmailStatus.ENQUEUED
        )
        readonly_fields = admin_instance.get_readonly_fields(request, email_config)
        assert len(readonly_fields) == 1
        assert readonly_fields[0] == 'live'
