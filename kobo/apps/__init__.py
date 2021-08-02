# coding: utf-8
from django.apps import AppConfig
from django.core.checks import register, Tags

from kpi.utils.two_database_configuration_checker import \
    TwoDatabaseConfigurationChecker


class KpiConfig(AppConfig):
    name = 'kpi'


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)
