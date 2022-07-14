# coding: utf-8
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from kpi.urls.router_api_v2 import ExtendedDefaultRouterWithPathAliases
from .views import LanguageViewSet

router = DefaultRouter()
router.register(r'languages', LanguageViewSet, basename='language')

urlpatterns = [
    path('', include(router.urls)),
]
