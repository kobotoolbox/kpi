# coding: utf-8
from django.apps import AppConfig


class AuditLogAppConfig(AppConfig):
    name = 'kobo.apps.audit_log'
    verbose_name = 'Audit'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.audit_log import signals

        super().ready()
