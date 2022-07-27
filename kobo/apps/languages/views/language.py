# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kpi.filters import SearchFilter
from .base import BaseViewSet
from ..models.language import Language
from ..serializers import LanguageSerializer


class LanguageViewSet(BaseViewSet):
    """

    Lists the languages accessible to requesting (authenticated) user.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/languages/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/languages/

    Search can be made with `q` parameter. By default, search for the term in language names or language codes.

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/languages/?q=fr
    >       {
    >           "count": 41
    >           "next": ...
    >           "previous": ...
    >           "results": [
    >               {
    >                   "name": "French",
    >                   "code": "fr",
    >                   "featured": true,
    >                   ...
    >               },
    >               {
    >                   "name": "Gula (Central African Republic)",
    >                   "code": "kcm",
    >                   "featured": false,
    >                   ...
    >               },
    >           ]
    >       }

    Complex searches can be done on other fields, such as `transcription_services` and `translation_services`.

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/languages/?q=transcription_services__code:goog AND translation_services__code:goog
    >       {
    >           "count": 1
    >           "next": ...
    >           "previous": ...
    >           "results": [
    >               {
    >                   "name": "English",
    >                   "code": "en",
    >                   "featured": true,
    >                   "transcription_services": [
    >                       {
    >                           "code": "goog",
    >                           "name": "Google"
    >                       }
    >                   ],
    >                   "translation_services": [
    >                       {
    >                           "code": "goog",
    >                           "name": "Google"
    >                       },
    >                   ],
    >               },
    >           ]
    >       }

    Results are order by `featured` first (descending order), then by their name.


    ## Get one language

    * `code` - is the unique identifier of a specific language

    <pre class="prettyprint">
    <b>GET</b> /api/v2/languages/<code>{code}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/languages/fr/
    >       {
    >           "name": "French",
    >           "code": "fr",
    >           "featured": true,
    >           "transcription_services": [
    >               {
    >                   "code": "goog",
    >                   "name": "Google"
    >               }
    >           ],
    >           "translation_services": [
    >               {
    >                   "code": "goog",
    >                   "name": "Google"
    >               },
    >           ],
    >       }


    ### CURRENT ENDPOINT
    """

    serializer_class = LanguageSerializer
    min_search_characters = 2
    queryset = Language.objects.all()
