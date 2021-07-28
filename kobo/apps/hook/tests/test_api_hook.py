# coding: utf-8
import json

import constance
import responses
from django.contrib.auth.models import User
from django.urls import reverse
from mock import patch
from rest_framework import status

from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.hook.models.hook import Hook
from kpi.constants import SUBMISSION_FORMAT_TYPE_JSON
from kpi.constants import (
    PERM_VIEW_SUBMISSIONS,
    PERM_CHANGE_ASSET
)
from .hook_test_case import HookTestCase, MockSSRFProtect


class ApiHookTestCase(HookTestCase):

    def test_anonymous_access(self):
        hook = self._create_hook()
        self.client.logout()

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

    @patch('ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
           new=MockSSRFProtect._get_ip_address)
    @responses.activate
    def test_data_submission(self):
        # Create first hook
        first_hook = self._create_hook(name="dummy external service",
                                       endpoint="http://dummy.service.local/",
                                       settings={})
        responses.add(responses.POST, first_hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type="application/json")
        hook_signal_url = reverse("hook-signal-list", kwargs={"parent_lookup_asset": self.asset.uid})

        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        data = {'submission_id': submissions[0]['_id']}
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

        data = {'submission_id': 4}  # Instance doesn't belong to `self.asset`
        response = self.client.post(hook_signal_url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_editor_access(self):
        hook = self._create_hook()

        list_url = reverse('hook-list', kwargs={
            'parent_lookup_asset': self.asset.uid
        })

        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        owner_results = response.get('results')

        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')

        # Try to access with another user who has only `change_asset` permission
        another_user = User.objects.get(username='anotheruser')
        hook.asset.assign_perm(another_user, PERM_CHANGE_ASSET)

        # Should return 404, user needs also `view_submissions`
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Retry will all permissions
        hook.asset.assign_perm(another_user, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_results, response.get('results'))

        detail_url = reverse('hook-detail', kwargs={
            'parent_lookup_asset': self.asset.uid,
            'uid': hook.uid,
        })

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        log_list_url = reverse('hook-log-list', kwargs={
            'parent_lookup_asset': self.asset.uid,
            'parent_lookup_hook': hook.uid,
        })

        response = self.client.get(log_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_editor_create(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        another_user = User.objects.get(username='anotheruser')
        self.asset.assign_perm(another_user, PERM_CHANGE_ASSET)
        self.asset.assign_perm(another_user, PERM_VIEW_SUBMISSIONS)

        response = self._create_hook(return_response_only=True,
                                     name='Hook for asset I can edit')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

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
        response = self._create_hook(return_response_only=True,
                                     name="Hook for asset I don't own")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_cannot_create(self):
        self.client.logout()
        response = self._create_hook(return_response_only=True,
                                     name="Hook for asset from anonymous")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

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
        response = self.client.patch(url, data, format=SUBMISSION_FORMAT_TYPE_JSON)
        self.assertEqual(response.status_code, status.HTTP_200_OK,
                         msg=response.data)
        hook.refresh_from_db()
        self.assertFalse(hook.active)
        self.assertEqual(hook.name, "some disabled external service")

    @patch('ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
           new=MockSSRFProtect._get_ip_address)
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
        response = self.client.patch(retry_url, format=SUBMISSION_FORMAT_TYPE_JSON)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Let's check if logs has 2 tries
        detail_url = reverse("hook-log-detail", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "parent_lookup_hook": self.hook.uid,
            "uid": first_log_response.get("uid")
        })

        response = self.client.get(detail_url, format=SUBMISSION_FORMAT_TYPE_JSON)
        self.assertEqual(response.data.get("tries"), 2)

    @patch('ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
           new=MockSSRFProtect._get_ip_address)
    @responses.activate
    def test_payload_template(self):

        payload_template = '{{"fields": {}}}'.format(SUBMISSION_PLACEHOLDER)
        hook = self._create_hook(name='Dummy hook with payload_template',
                                 endpoint='http://payload-template.dummy.local/',
                                 payload_template=payload_template)

        ServiceDefinition = hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']
        service_definition = ServiceDefinition(hook, submission_id)

        def request_callback(request):
            payload = json.loads(request.body)
            resp_body = payload
            headers = {'request-id': str(submission_id)}
            return 200, headers, json.dumps(resp_body)

        responses.add_callback(
            responses.POST, hook.endpoint,
            callback=request_callback,
            content_type='application/json',
        )

        success = service_definition.send()
        self.assertTrue(success)

        # Retrieve the corresponding log
        url = reverse('hook-log-list', kwargs={
            'parent_lookup_asset': hook.asset.uid,
            'parent_lookup_hook': hook.uid
        })

        response = self.client.get(url)
        first_hooklog_response = response.data.get('results')[0]
        expected_response = json.loads(payload_template.replace(
            SUBMISSION_PLACEHOLDER,
            json.dumps(submissions[0])))

        self.assertEqual(first_hooklog_response.get('status_code'),
                         status.HTTP_200_OK)
        self.assertEqual(json.loads(first_hooklog_response.get('message')), 
                         expected_response)

    def test_unsecured_endpoint_validation(self):

        constance.config.ALLOW_UNSECURED_HOOK_ENDPOINTS = False

        response = self._create_hook(return_response_only=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        expected_response = {"endpoint": ["Unsecured endpoint is not allowed"]}
        self.assertEqual(response.data, expected_response)
    
    def test_payload_template_validation(self):

        # Test invalid JSON
        response = self._create_hook(payload_template='foo', 
                                     return_response_only=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        expected_response = {
            'payload_template': ['Invalid JSON']
        }
        self.assertEqual(response.data, expected_response)

        # Test with XML type
        self.asset = self.create_asset(
            'asset_for_tests_with_xml',
            content=json.dumps(self.asset.content),
            format='json')
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        payload_template = '{{"fields": {}}}'.format(SUBMISSION_PLACEHOLDER)
        response = self._create_hook(payload_template=payload_template, 
                                     format_type=Hook.XML,
                                     return_response_only=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        expected_response = {
            'payload_template': ['Can be used only with JSON submission format']
        }
        self.assertEqual(response.data, expected_response)
