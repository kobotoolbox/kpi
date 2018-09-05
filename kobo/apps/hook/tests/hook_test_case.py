# -*- coding: utf-8 -*-
from __future__ import absolute_import

import json

from django.conf import settings
from django.core.urlresolvers import reverse
import responses
from rest_framework import status




from ..constants import HOOK_LOG_FAILED
from ..models import HookLog, Hook
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON
from kpi.tests.kpi_test_case import KpiTestCase


class HookTestCase(KpiTestCase):

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        self.asset = self.create_asset(
            "some_asset",
            content=json.dumps({"survey": [{"type": "text", "name": "q1"}]}),
            format="json")
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self.hook = Hook()

        v_uid = self.asset.latest_deployed_version.uid
        submission = {
            "__version__": v_uid,
            "q1": u"¿Qué tal?",
            "id": 1
        }
        self.asset.deployment._mock_submission(submission)
        self.asset.save(create_version=False)
        settings.CELERY_TASK_ALWAYS_EAGER = True

    def _create_hook(self, return_response_only=False, **kwargs):
        url = reverse("hook-list", kwargs={"parent_lookup_asset": self.asset.uid})
        data = {
            "name": kwargs.get("name", "some external service with token"),
            "endpoint": kwargs.get("endpoint", "http://external.service.local/"),
            "settings": kwargs.get("settings", {
                "custom_headers": {
                    "X-Token": "1234abcd"
                }
            }),
            "active": kwargs.get("active", True),
            "filtered_fields": kwargs.get("filtered_fields", [])
        }
        response = self.client.post(url, data, format=INSTANCE_FORMAT_TYPE_JSON)
        if return_response_only:
            return response
        else:
            self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                             msg=response.data)
            hook = self.asset.hooks.last()
            self.assertTrue(hook.active)
            return hook

    def _send_and_fail(self):
        """

        The public method which calls this method, needs to be decorated by `@responses.activate
        :return: dict
        """
        self.hook = self._create_hook()

        ServiceDefinition = self.hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions()
        uuid = submissions[0].get("id")
        service_definition = ServiceDefinition(self.hook, uuid)
        first_mock_response = {"error": "not found"}

        # Mock first requests try
        responses.add(responses.POST, self.hook.endpoint,
                      json=first_mock_response, status=status.HTTP_404_NOT_FOUND)

        # Mock next requests tries
        responses.add(responses.POST, self.hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type="application/json")

        # Try to send data to external endpoint
        success = service_definition.send()
        self.assertFalse(success)

        # Retrieve the corresponding log
        url = reverse("hook-log-list", kwargs={
            "parent_lookup_asset": self.hook.asset.uid,
            "parent_lookup_hook": self.hook.uid
        })

        response = self.client.get(url, format=INSTANCE_FORMAT_TYPE_JSON)
        first_hooklog_response = response.data.get("results")[0]

        # Result should match first try
        self.assertEqual(first_hooklog_response.get("status_code"), status.HTTP_404_NOT_FOUND)
        self.assertEqual(json.loads(first_hooklog_response.get("message")), first_mock_response)

        # Fakes Celery n retries by forcing status to `failed` (where n is `settings.HOOKLOG_MAX_RETRIES`)
        first_hooklog = HookLog.objects.get(uid=first_hooklog_response.get("uid"))
        first_hooklog.change_status(HOOK_LOG_FAILED)

        return first_hooklog_response