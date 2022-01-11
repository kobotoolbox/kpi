# coding: utf-8
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import transcription_languages


class TranscriptionLanguagesView(APIView):

    def get(self, request, *args, **kwargs):
        keys = transcription_languages.keys()
        data = []

        for key in keys:
            data.append({transcription_languages[key]['name']: key})

        return Response(data)

    def post(self, request, *args, **kwargs):
        language_code = request.data['language_code']
        data = transcription_languages.get(language_code)['options']
        return Response(data)


