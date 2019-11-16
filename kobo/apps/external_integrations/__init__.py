# coding: utf-8
from __future__ import (division, print_function, absolute_import,
                        unicode_literals)

from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _


class ExternalIntegrationsAppConfig(AppConfig):
    name = 'kobo.apps.external_integrations'
    verbose_name = _('External integrations')
