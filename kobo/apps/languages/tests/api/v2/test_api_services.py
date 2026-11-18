# coding: utf-8
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.languages.models.transcription import TranscriptionService
from kobo.apps.languages.models.translation import TranslationService
from .base import BaseApiTestCase


class TranscriptionServiceListApiTestCase(BaseApiTestCase):

    def test_can_list_as_authenticated_user(self):
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cannot_list_as_anonymous_user(self):
        self.client.logout()
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_with_search(self):
        """
        Search within transcription service names and codes.
        """
        url = f"{reverse(self._get_endpoint('transcription_service-list'))}?q=goo"
        response = self.client.get(url)
        expected_codes = ['goog']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_codes,
            [service['code'] for service in response.data['results']],
        )

    def test_list_with_2_characters_search(self):
        """
        Try to search with only 2 characters
        """
        url = f"{reverse(self._get_endpoint('transcription_service-list'))}?q=ms"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('detail' in response.data)
        self.assertEqual(str(response.data['detail']), 'Your query is too short')

    def test_sort(self):
        """
        Should sort by name ASC when priorities are equal
        """
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        expected_names = ['Google', 'Microsoft']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_names,
            [service['name'] for service in response.data['results']],
        )

    def test_sort_by_priority(self):
        """
        Should sort by priority ASC before name
        """
        TranscriptionService.objects.filter(code='msft').update(priority=1)
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert [service['name'] for service in response.data['results']] == [
            'Microsoft',
            'Google',
        ]

    def test_priority_is_exposed(self):
        """
        Should include the priority of each service
        """
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert [service['priority'] for service in response.data['results']] == [
            100,
            100,
        ]

    def test_action_id_is_exposed(self):
        """
        Should include the action ID of each service, null without an action
        """
        response = self.client.get(
            reverse(self._get_endpoint('transcription_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert {
            service['code']: service['action_id']
            for service in response.data['results']
        } == {
            'goog': 'automatic_google_transcription',
            'msft': None,
        }


class TranslationServiceListApiTestCase(BaseApiTestCase):

    def test_can_list_as_authenticated_user(self):
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cannot_list_as_anonymous_user(self):
        self.client.logout()
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_with_search(self):
        """
        Search within translation service names and codes.
        """
        url = f"{reverse(self._get_endpoint('translation_service-list'))}?q=goo"
        response = self.client.get(url)
        expected_codes = ['goog']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_codes,
            [service['code'] for service in response.data['results']],
        )

    def test_list_with_2_characters_search(self):
        """
        Try to search with only 2 characters
        """
        url = f"{reverse(self._get_endpoint('translation_service-list'))}?q=ms"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('detail' in response.data)
        self.assertEqual(str(response.data['detail']), 'Your query is too short')

    def test_sort(self):
        """
        Should sort by name ASC when priorities are equal
        """
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        expected_names = ['Google', 'Microsoft']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_names,
            [service['name'] for service in response.data['results']],
        )

    def test_sort_by_priority(self):
        """
        Should sort by priority ASC before name
        """
        TranslationService.objects.filter(code='msft').update(priority=1)
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert [service['name'] for service in response.data['results']] == [
            'Microsoft',
            'Google',
        ]

    def test_priority_is_exposed(self):
        """
        Should include the priority of each service
        """
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert [service['priority'] for service in response.data['results']] == [
            100,
            100,
        ]

    def test_action_id_is_exposed(self):
        """
        Should include the action ID of each service, null without an action
        """
        response = self.client.get(
            reverse(self._get_endpoint('translation_service-list'))
        )
        assert response.status_code == status.HTTP_200_OK
        assert {
            service['code']: service['action_id']
            for service in response.data['results']
        } == {
            'goog': 'automatic_google_translation',
            'msft': None,
        }
