# coding: utf-8
import trench
from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.accounts.mfa'
    verbose_name = 'Multi-factor authentication'

    def ready(self):
        # These imports cannot be at the top until the app is loaded.
        from kobo.apps.accounts.mfa.command import (
            create_mfa_method_command,
            deactivate_mfa_method_command,
        )
        # Makes sure all signal handlers are connected
        from kobo.apps.accounts.mfa import signals

        # Monkey-patch `django-trench` to avoid duplicating lots of code in views,
        # and serializers just for few line changes.

        # Changed behaviours:
        # 1. Stop blocking deactivation of primary method
        trench.command.deactivate_mfa_method.deactivate_mfa_method_command = (
            deactivate_mfa_method_command
        )
        # 2. Resetting secret on reactivation
        trench.command.create_mfa_method.create_mfa_method_command = (
            create_mfa_method_command
        )
        super().ready()
