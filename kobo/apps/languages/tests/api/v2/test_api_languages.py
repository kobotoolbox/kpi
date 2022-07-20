# coding: utf-8
from rest_framework import status
from rest_framework.reverse import reverse

from .base import BaseApiTestCase


class LanguageListApiTestCase(BaseApiTestCase):

    def test_can_list_as_authenticated_user(self):
        response = self.client.get(reverse('language-list'))
        print('response', response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cannot_list_as_anonymous_user(self):
        self.client.logout()
        response = self.client.get(reverse('language-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_with_search(self):
        """
        Search within language names and codes.
        """
        url = f"{reverse('language-list')}?q=fr"
        response = self.client.get(url)
        expected_codes = ['fr', 'af']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_codes,
            [language['code'] for language in response.data['results']],
        )

    def test_list_with_utf8_search(self):
        """
        Search within language names and codes with non-ascii characters
        """
        url = f"{reverse('language-list')}?q=hé"
        response = self.client.get(url)
        expected_codes = ['guq']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_codes,
            [language['code'] for language in response.data['results']],
        )

    def test_list_with_advanced_search(self):
        """
        Search for languages which can be translated with Microsoft service
        but transcribed with Google.
        """
        search_query = (
            'translation_services__code:msft '
            'AND transcription_services__code:goog'
        )
        url = f"{reverse('language-list')}?q={search_query}"
        response = self.client.get(url)
        expected_names = ['French']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_names,
            [language['name'] for language in response.data['results']],
        )

    def test_sort(self):
        """
        Should sort by featured DESC, name ASC
        """
        response = self.client.get(reverse('language-list'))
        expected_names = ['English', 'French', 'Aché', 'Afrikaans', 'Hebrew']
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            expected_names,
            [language['name'] for language in response.data['results']],
        )
