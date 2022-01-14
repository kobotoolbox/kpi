# coding: utf-8
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import transcription_languages


class TranscriptionLanguagesView(APIView):
    """
    ## List of Transcription Languages Endpoint

    List of languages available for transcription services

    <pre class="prettyprint">
        <b>GET</b> /environment/transcription_languages/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/environment/transcription_languages/

    ### List of engines available for a language

    The language code must be in the format of `en-US`

    <pre class="prettyprint">
        <b>POST</b> /environment/transcription_languages/
    </pre>

    > Example
    >
    >       curl -X POST http://kf.kobo.local/environment/transcription_languages/ /
    >           -d '{"language_code": "[language_code]"}'
    >           -H "Content-Type: application/json"


    """

    def get(self, request, *args, **kwargs):

        keys = transcription_languages.keys()
        data = []

        for key in keys:
            data.append({'name': transcription_languages[key]['name'], 'language_code': key})

        return Response(data)

    def post(self, request, *args, **kwargs):

        if 'language_code' in request.data:
            data = {'options': transcription_languages.get(
                request.data['language_code'])['options']}
            return Response(data)

        else:
            raise Exception('Missing required data')
