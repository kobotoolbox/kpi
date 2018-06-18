# -*- coding: utf-8 -*-
from django.core.urlresolvers import reverse
from rest_framework import status

from kpi.tests.kpi_test_case import KpiTestCase


class ApiHookTestCase(KpiTestCase):

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        self.some_asset = self.create_asset("some_asset")

    def _create_hook(self):

        url = reverse("hook-list", kwargs={"parent_lookup_asset": self.some_asset.uid})
        data = {
            "name": "some external service",
            "endpoint": "https://example.com"
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        hook = self.some_asset.hooks.last()
        self.assertTrue(hook.active)
        return hook

    def test_create_hook(self):
        self._create_hook()

    def test_partial_update_hook(self):
        hook = self._create_hook()
        url = reverse("hook-detail", kwargs={
            "parent_lookup_asset": self.some_asset.uid,
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


