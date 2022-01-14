# coding: utf-8
import json

from django.urls import reverse
from rest_framework import status

from kobo.static_lists import (
    transcription_languages,
    translation_languages
)
from kpi.tests.base_test_case import BaseTestCase


class EnvironmentLanguageEndpoints(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.ts_url = reverse('transcription-languages')
        self.tl_url = reverse('translation-languages')

    @staticmethod
    def check_language_engines(engine_type, engine):
        data = []
        if engine_type == 'transcription':
            for key in transcription_languages:
                language = transcription_languages.get(key)
                if engine in language['options']:
                    data.append({"name": language['name'], "language_code": key})

        elif engine_type == 'translation':
            for key in translation_languages:
                language = translation_languages.get(key)
                if engine in language['options']:
                    data.append({"name": language['name'], "language_code": key})

        else:
            raise Exception('Incorrect Engine Type')

        return data

    def test_anonymous_succeeds(self):
        # transcription url
        response = self.client.get(self.ts_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # translation url
        response = self.client.get(self.ts_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_authenticated_succeeds(self):
        # transcription url
        self.client.login(username='admin', password='pass')
        ts_response = self.client.get(self.ts_url, format='json')
        self.assertEqual(ts_response.status_code, status.HTTP_200_OK)

        # translation url
        self.client.login(username='admin', password='pass')
        tl_response = self.client.get(self.tl_url, format='json')
        self.assertEqual(tl_response.status_code, status.HTTP_200_OK)

    def test_post_succeeds(self):
        ts_response_list = {'options': transcription_languages.get('en-GB')['options']}
        tl_response_list = {'options': translation_languages.get('en')['options']}

        # transcript url
        ts_response = self.client.post(self.ts_url, data={'language_code': 'en-GB'})
        self.assertEqual(ts_response.status_code, status.HTTP_200_OK)
        ts_response_content = json.loads(ts_response.content)
        self.assertEqual(ts_response_content, ts_response_list)

        # translation url
        tl_response = self.client.post(self.tl_url, data={'language_code': 'en'})
        self.assertEqual(tl_response.status_code, status.HTTP_200_OK)
        tl_response_content = json.loads(tl_response.content)
        self.assertEqual(tl_response_content, tl_response_list)

        tl_engine_response = self.client.post(self.tl_url, data={'engine': 'Microsoft'})
        self.assertEqual(tl_engine_response.status_code, status.HTTP_200_OK)
        tl_engine_response_content = json.loads(tl_engine_response.content)
        self.assertEqual(
            tl_engine_response_content,
            self.check_language_engines('translation', 'Microsoft')
        )
