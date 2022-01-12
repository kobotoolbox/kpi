# coding: utf-8
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import translation_languages


class TranslationLanguagesView(APIView):

    def get(self, request):
        keys = translation_languages.keys()
        data = []

        for key in keys:
            data.append({"name": translation_languages[key]['name'], "language_code": key})

        return Response(data)

    def post(self, request):

        if "language_code" in request.data:

            data = translation_languages.get(
                request.data['language_code'])['options']
            return Response(data)

        elif "engine" in request.data:
            data = []
            for key in translation_languages:
                language = translation_languages.get(key)
                if request.data['engine'] in language['options']:
                    data.append({"name": language['name'], "language_code": key})

            return Response(data)

        else:
            raise Exception('Missing required data')
