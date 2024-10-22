# coding: utf-8
from ipaddress import ip_address
from unittest.mock import MagicMock, patch

import responses
from django.conf import settings
from django.core import mail
from django.template.loader import get_template
from django.utils import dateparse, translation
from django_celery_beat.models import CrontabSchedule, PeriodicTask

from ..tasks import failures_reports
from .hook_test_case import HookTestCase


class EmailTestCase(HookTestCase):

    def _create_periodic_task(self):
        beat_schedule = settings.CELERY_BEAT_SCHEDULE.get('send-hooks-failures-reports')
        schedule = beat_schedule.get('schedule')
        crontab, _ = CrontabSchedule.objects.get_or_create(
            hour=schedule.hour, minute=schedule.minute
        )
        periodic_task, _ = PeriodicTask.objects.get_or_create(
            name='Periodic Task Mock',
            enabled=True,
            crontab=crontab,
            task=beat_schedule.get('task'),
        )

        return periodic_task

    @patch(
        'ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
        new=MagicMock(return_value=ip_address('1.2.3.4')),
    )
    @responses.activate
    def test_notifications(self):
        self._create_periodic_task()
        first_log_response = self._send_and_fail()
        failures_reports.apply_async(queue='kpi_low_priority_queue')
        self.assertEqual(len(mail.outbox), 1)

        expected_record = {
            'username': self.asset.owner.username,
            'email': self.asset.owner.email,
            'language': 'en',
            'assets': {
                self.asset.uid: {
                    'name': self.asset.name,
                    'hook_uid': self.hook.uid,
                    'max_length': len(self.hook.name),
                    'logs': [
                        {
                            'hook_name': self.hook.name,
                            'status_code': first_log_response.get('status_code'),
                            'message': first_log_response.get('message'),
                            'uid': first_log_response.get('uid'),
                            'date_modified': dateparse.parse_datetime(
                                first_log_response.get('date_modified')
                            ),
                        }
                    ],
                }
            }
        }

        plain_text_template = get_template('reports/failures_email_body.txt')

        variables = {
            'username': expected_record.get('username'),
            'assets': expected_record.get('assets'),
            'kpi_base_url': settings.KOBOFORM_URL
        }
        # Localize templates
        translation.activate(expected_record.get('language'))
        text_content = plain_text_template.render(variables)

        self.assertEqual(mail.outbox[0].body, text_content)
