import haystack
from django.apps import AppConfig

class KpiConfig(AppConfig):
    name = 'kpi'
    def ready(self):
        # Haystack loads the signal processor too early, so we connect signals
        # here as a workaround. This should be fixed when Django 1.9
        # compatibility is fully implemented. See
        # https://github.com/django-haystack/django-haystack/pull/1277
        haystack.signal_processor.load_models()
