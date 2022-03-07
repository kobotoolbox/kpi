# coding: utf-8
import json
import os
import requests
import uuid


class AzureTranslation:

    def __init__(self):
        self.subscription = os.environ['AZURE_TRANSLATION_API_KEY']
        self.location = os.environ['AZURE_REGION']
        self.endpoint = 'https://api.cognitive.microsofttranslator.com/translate'

    def translate(
            self,
            content: str,
            src_lang: str,
            trg_lang: str
    ):
        params = {
            'api-version': '3.0',
            'from': src_lang,
            'to': trg_lang
        }

        headers = {
            'Ocp-Apim-Subscription-Key': self.subscription,
            'Ocp-Apim-Subscription-Region': self.location,
            'Content-type': 'application/json',
            'X-ClientTraceId': str(uuid.uuid4())
        }

        body = [{'text': content}]
        request = requests.post(self.endpoint, params=params, headers=headers, json=body)
        response = request.json()
        return response[0]['translations'][0]['text']
