from django.apps import AppConfig


class FormDisclaimerAppConfig(AppConfig):
    name = 'kobo.apps.form_disclaimer'
    verbose_name = 'Form disclaimer'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        from kobo.apps.form_disclaimer import signals
        super().ready()
