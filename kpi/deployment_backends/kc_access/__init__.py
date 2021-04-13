# coding: utf-8
from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _


class ShadowModelsAppConfig(AppConfig):
    name = 'kpi.deployment_backends.kc_access'
    verbose_name = _('Shadow Models')
    label = 'shadow_model'