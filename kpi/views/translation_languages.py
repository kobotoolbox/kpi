# coding: utf-8
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import translation_languages


class TranslationLanguagesView(APIView):
    """
    ## List of Translation Languages Endpoint

    List of languages available for translation services

    <pre class="prettyprint">
        <b>GET</b> /environment/translation_languages/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/environment/translation_languages/

    ### List of translation engines available for a language

    Get the list of engines available for a translation engine

    <pre class="prettyprint">
        <b>POST</b> /environment/translation_languages/
    </pre>

    > Example
    >
    >       curl -X POST http://kf.kobo.local/environment/translation_languages/ /
    >           -d '{"language_code": "[language_code]"}'
    >           -H "Content-Type: application/json"

    The language code must be in the format of `en-US`

    ### List of available languages for a translation engine

    Get the list of languages available for a specific enging

    <pre class="prettyprint">
        <p>POST</p>
    </pre>

    > Example
    >
    >       curl -X POST http://kf.kobo.local/environment/translation_languages/ /
    >           -d '{"engine": "[engine]"}'
    >           -H "Content-Type: application/json"

    #### Engines available
    * Google Translate API [Google]

    """
    # * Amazon Translate [Amazon]
    # * IBM Cloud Translation [IBM]
    # * Microsoft Translator [Microsoft]
    # * Translators without Borders API [TWB]

    def get(self, request):
        keys = translation_languages.keys()
        data = []

        for key in keys:
            data.append({'name': translation_languages[key]['name'], 'language_code': key})

        return Response(data)

    def post(self, request):

        if 'language_code' in request.data:
            try:
                data = {'options': translation_languages.get(
                    request.data['language_code'])['options']}
            except TypeError:
                data = {"selection_error": "Language is not supported"}
            return Response(data)

        elif "engine" in request.data:
            data = []
            for key in translation_languages:
                language = translation_languages.get(key)
                if request.data['engine'] in language['options']:
                    data.append({'name': language['name'], 'language_code': key})

            return Response(data)

        else:
            raise ValidationError('Missing required data')
