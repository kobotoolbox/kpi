# coding: utf-8
from django.apps import AppConfig
from kpi.constants import SHADOW_MODEL_APP_LABEL


class ShadowModelAppConfig(AppConfig):
    """
    This app is not in-use but needed because one of shadow models is registered
    in Django Admin.
    """
    name = 'kobo.apps.shadow_model'
    verbose_name = 'KoBoCAT data'
    label = SHADOW_MODEL_APP_LABEL
