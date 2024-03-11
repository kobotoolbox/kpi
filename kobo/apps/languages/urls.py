# coding: utf-8
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LanguageViewSet,
    TranslationServiceViewSet,
    TranscriptionServiceViewSet,
)

router = DefaultRouter()
router.register(r'languages', LanguageViewSet, basename='language')
router.register(
    r'transcription-services',
    TranscriptionServiceViewSet,
    basename='transcription_service',
)
router.register(
    r'translation-services',
    TranslationServiceViewSet,
    basename='translation_service',
)

urlpatterns = []
