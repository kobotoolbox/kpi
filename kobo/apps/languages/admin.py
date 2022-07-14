# coding: utf-8
from django.contrib import admin

from .models.language import (
    Language,
    LanguageAdmin,
)
from .models.transcription import (
    TranscriptionService,
    TranscriptionServiceAdmin,
)
from .models.translation import (
    TranslationService,
    TranslationServiceAdmin,
)

admin.site.register(Language, LanguageAdmin)
admin.site.register(TranslationService, TranscriptionServiceAdmin)
admin.site.register(TranscriptionService, TranslationServiceAdmin)
