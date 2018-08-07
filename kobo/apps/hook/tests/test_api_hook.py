# -*- coding: utf-8 -*-
import json
import requests
import responses

from django.conf import settings
from django.core.urlresolvers import reverse
from rest_framework import status

from ..constants import HOOK_LOG_FAILED
from ..models.hook_log import HookLog
from kpi.tests.kpi_test_case import KpiTestCase


class ApiHookTestCase(KpiTestCase):

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        self.asset = self.create_asset(
            "some_asset",
            content=json.dumps({"survey": [{"type": "text", "name": "q1"}]}),
            format="json")
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        v_uid = self.asset.latest_deployed_version.uid
        submission = {
            "__version__": v_uid,
            "q1": u"¿Qué tal?",
            "id": 1
        }
        self.asset.deployment._mock_submission(submission)
        self.asset.save(create_version=False)
        settings.CELERY_ALWAYS_EAGER = True

    def _create_hook(self):
        url = reverse("hook-list", kwargs={"parent_lookup_asset": self.asset.uid})
        data = {
            "name": "some external service with token",
            "endpoint": "http://external.service.local/",
            "settings": {
                "custom_headers": {
                    "X-Token": "1234abcd"
                }
            }
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        hook = self.asset.hooks.last()
        self.assertTrue(hook.active)
        return hook

    def test_anonymous_access(self):
        hook = self._create_hook()
        self.client.logout()

        list_url = reverse("hook-list", kwargs={
            "parent_lookup_asset": self.asset.uid
        })

        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        detail_url = reverse("hook-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "uid": hook.uid,
        })

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        log_list_url = reverse("hook-log-list", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": hook.uid,
        })

        response = self.client.get(log_list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_not_owner_access(self):
        hook = self._create_hook()
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")

        list_url = reverse("hook-list", kwargs={
            "parent_lookup_asset": self.asset.uid
        })

        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        detail_url = reverse("hook-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "uid": hook.uid,
        })

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        log_list_url = reverse("hook-log-list", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": hook.uid,
        })

        response = self.client.get(log_list_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


    def test_create_hook(self):
        self._create_hook()

    def test_partial_update_hook(self):
        hook = self._create_hook()
        url = reverse("hook-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "uid": hook.uid
        })
        data = {
            "name": "some disabled external service",
            "active": False
        }
        response = self.client.patch(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK,
                         msg=response.data)
        hook.refresh_from_db()
        self.assertFalse(hook.active)
        self.assertEqual(hook.name, "some disabled external service")

    @responses.activate
    def test_send_and_retry(self):
        hook = self._create_hook()

        ServiceDefinition = hook.get_service_definition()
        submissions = self.asset.deployment._get_submissions()
        service_definition = ServiceDefinition(hook, submissions[0])
        first_mock_response = {"error": "not found"}

        # Mock first requests try
        responses.add(responses.POST, hook.endpoint,
                      json=first_mock_response, status=status.HTTP_404_NOT_FOUND)
        # Mock next requests tries
        responses.add(responses.POST, hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type="application/json")

        # Try to send data to external endpoint
        success = service_definition.send()
        self.assertFalse(success)

        # Retrieve the corresponding log
        url = reverse("hook-log-list", kwargs={
            "parent_lookup_asset": hook.asset.uid,
            "parent_lookup_hook": hook.uid
        })

        response = self.client.get(url, format="json")
        first_hooklog = response.data.get("results")[0]

        # Result should match first try
        self.assertEqual(first_hooklog.get("status_code"), status.HTTP_404_NOT_FOUND)
        self.assertEqual(json.loads(first_hooklog.get("message")), first_mock_response)

        # Let's retry through API call
        retry_url = reverse("hook-log-retry", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": hook.uid,
            "uid": first_hooklog.get("uid")
        })

        # Fakes Celery n retries by forcing status to `failed` (where n is `settings.HOOKLOG_MAX_RETRIES`)
        fhl = HookLog.objects.get(uid=first_hooklog.get("uid"))
        fhl.status = HOOK_LOG_FAILED
        fhl.save(reset_status=True)

        # It should be a success
        response = self.client.patch(retry_url, format="json")
        self.assertTrue(response.data.get("success"))

        # Let's check if logs has 2 tries
        detail_url = reverse("hook-log-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": hook.uid,
            "uid": first_hooklog.get("uid")
        })

        response = self.client.get(detail_url, format="json")
        self.assertEqual(response.data.get("tries"), 2)