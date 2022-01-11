from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import translation_languages


class TranslationLanguagesView(APIView):

    def get(self, request):
        keys = translation_languages.keys()
        data = []

        for key in keys:
            data.append({translation_languages[key]['name']: key})

        return Response(data)

    def post(self, request):
        language_code = request.data['language_code']
        data = translation_languages.get(language_code)['options']
        return Response(data)
