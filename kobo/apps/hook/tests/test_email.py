# -*- coding: utf-8 -*-
from __future__ import absolute_import

import json

from django.conf import settings
from django.core import mail
from django_celery_beat.models import PeriodicTask
from django.template import Context
from django.template.loader import get_template
from django.utils import translation, dateparse
import responses
from rest_framework import status

from .hook_test_case import HookTestCase
from ..tasks import failures_reports
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON


class EmailTestCase(HookTestCase):

    def _create_periodisk_task(self):
        beat_schedule = settings.CELERY_BEAT_SCHEDULE.get("send-hooks-failures-reports")
        periodic_task = PeriodicTask(name="Periodic Task Mock",
                                     enabled=True,
                                     task=beat_schedule.get("task"))
        periodic_task.save()


    @responses.activate
    def test_notifications(self):
        self._create_periodisk_task()
        first_log_response = self._send_and_fail()
        failures_reports.delay()
        self.assertEqual(len(mail.outbox), 1)

        expected_record = {
            "username": self.asset.owner.username,
            "email": self.asset.owner.email,
            "language": "en",
            "assets": {
                self.asset.id: {
                    "name": self.asset.name,
                    "max_length": len(self.hook.name),
                    "logs": [{
                        "hook_name": self.hook.name,
                        "status_code": first_log_response.get("status_code"),
                        "message": first_log_response.get("message"),
                        "uid": first_log_response.get("uid"),
                        "date_modified": dateparse.parse_datetime(first_log_response.get("date_modified"))
                    }]
                }
            }
        }

        plain_text_template = get_template("reports/failures_email_body.txt")

        variables = {
            "username": expected_record.get("username"),
            "assets": expected_record.get("assets")
        }
        ## Localize templates
        translation.activate(expected_record.get("language"))
        text_content = plain_text_template.render(Context(variables))

        self.assertEqual(mail.outbox[0].body, text_content)
