from django.apps import AppConfig


class StripeAppConfig(AppConfig):
    name = 'kobo.apps.stripe'
    verbose_name = 'Stripe'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.stripe import signals  # noqa

        super().ready()
