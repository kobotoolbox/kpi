from django.conf import settings
from rest_framework.settings import APISettings, DEFAULTS, IMPORT_STRINGS


openrosa_drf_settings = APISettings(
    settings.OPENROSA_REST_FRAMEWORK, DEFAULTS, IMPORT_STRINGS
)
