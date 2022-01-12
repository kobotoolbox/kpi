# coding: utf-8
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import transcription_languages


class TranscriptionLanguagesView(APIView):

    def get(self, request, *args, **kwargs):

        keys = transcription_languages.keys()
        data = []

        for key in keys:
            data.append({"name": transcription_languages[key]['name'], "language_code": key})

        return Response(data)

    def post(self, request, *args, **kwargs):

        if "language_code" in request.data:
            data = transcription_languages.get(request.data['language_code'])['options']
            return Response(data)

        elif "engine" in request.data:
            data = []
            for key in transcription_languages:
                language = transcription_languages.get(key)
                if request.data['engine'] in language['options']:
                    data.append({"name": language['name'], "language_code": key})

            return Response(data)

        else:
            raise Exception('Missing required data')
