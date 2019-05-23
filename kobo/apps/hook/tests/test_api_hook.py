# -*- coding: utf-8 -*-
from __future__ import absolute_import

import json

import constance
from django.core.urlresolvers import reverse
import requests
import responses
from rest_framework import status

from .hook_test_case import HookTestCase
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON


class ApiHookTestCase(HookTestCase):

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

    def test_create_hook(self):
        self._create_hook()

    def test_data_submission(self):
        # Create first hook
        first_hook = self._create_hook(name="dummy external service",
                                       endpoint="http://dummy.service.local/",
                                       settings={})
        responses.add(responses.POST, first_hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type="application/json")
        hook_signal_url = reverse("hook-signal-list", kwargs={"parent_lookup_asset": self.asset.uid})

        submissions = self.asset.deployment.get_submissions()
        data = {"instance_id": submissions[0].get("id")}
        response = self.client.post(hook_signal_url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        # Create second hook
        second_hook = self._create_hook(name="other dummy external service",
                                        endpoint="http://otherdummy.service.local/",
                                        settings={})
        responses.add(responses.POST, second_hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type="application/json")

        response = self.client.post(hook_signal_url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        response = self.client.post(hook_signal_url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

        data = {"instance_id": 4}  # Instance doesn't belong to `self.asset`
        response = self.client.post(hook_signal_url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_cannot_access(self):
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

    def test_non_owner_cannot_create(self):
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")
        response = self._create_hook(return_response_only=True, name="Hook for asset I don't own")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_cannot_create(self):
        self.client.logout()
        response = self._create_hook(return_response_only=True, name="Hook for asset from anonymous")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
        response = self.client.patch(url, data, format=INSTANCE_FORMAT_TYPE_JSON)
        self.assertEqual(response.status_code, status.HTTP_200_OK,
                         msg=response.data)
        hook.refresh_from_db()
        self.assertFalse(hook.active)
        self.assertEqual(hook.name, "some disabled external service")

    @responses.activate
    def test_send_and_retry(self):

        first_log_response = self._send_and_fail()

        # Let's retry through API call
        retry_url = reverse("hook-log-retry", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": self.hook.uid,
            "uid": first_log_response.get("uid")
        })

        # It should be a success
        response = self.client.patch(retry_url, format=INSTANCE_FORMAT_TYPE_JSON)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Let's check if logs has 2 tries
        detail_url = reverse("hook-log-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": self.hook.uid,
            "uid": first_log_response.get("uid")
        })

        response = self.client.get(detail_url, format=INSTANCE_FORMAT_TYPE_JSON)
        self.assertEqual(response.data.get("tries"), 2)

    def test_validation(self):

        constance.config.ALLOW_UNSECURED_HOOK_ENDPOINTS = False

        response = self._create_hook(return_response_only=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        expected_response = {"endpoint": ["Unsecured endpoint is not allowed"]}
        self.assertEqual(response.data, expected_response)
