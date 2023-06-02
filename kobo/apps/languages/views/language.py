# coding: utf-8
from collections import defaultdict

from .base import BaseViewSet
from ..models.language import Language
from ..serializers import (
    LanguageSerializer,
    LanguageListSerializer,
)


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
    >                       }
    >                   ],
    >                   "url": "https://[kpi]/api/v2/languages/en/"
    >               },
    >               ...
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
    >           "transcription_services": {
    >               "goog": {
    >                   "fr-CA": "fr-CA",
    >                   "fr-FR": "fr-FR"
    >               },
    >               "msft": {
    >                   "fr-CA": "fr-CA",
    >                   "fr-FR": "fr-FR"
    >               }
    >           },
    >           "translation_services": {
    >               "goog": {
    >                   "fr-CA": "fr-CA",
    >                   "fr-FR": "fr-FR"
    >               },
    >               "msft": {
    >                   "fr": "fr",
    >                   "fr-CA": "fr-CA",
    >               }
    >           },
    >       }


    ### CURRENT ENDPOINT
    """

    serializer_class = LanguageListSerializer
    min_search_characters = 2

    def get_queryset(self):
        if self.action == 'list':
            return Language.objects.all()
        else:
            return Language.objects.prefetch_related('regions')

    def get_serializer_class(self):
        if self.action == 'list':
            return LanguageListSerializer
        else:
            return LanguageSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            # In list view, because of slowness of multiple joins, we only list
            # the available services without any other details such as the
            # supported regions and their mapping codes.

            # We cache service objects to avoid multiple queries within the
            # serializer to retrieve them.
            transcription_services = defaultdict(set)
            queryset = (
                Language.transcription_services.through.objects.select_related(
                    'service'
                )
            )
            for through in queryset.all():
                transcription_services[through.language_id].add(through.service)

            translation_services = defaultdict(set)
            queryset = (
                Language.translation_services.through.objects.select_related(
                    'service'
                )
            )
            for through in queryset.all():
                translation_services[through.language_id].add(through.service)

            context['transcription_services'] = transcription_services
            context['translation_services'] = translation_services

        return context
