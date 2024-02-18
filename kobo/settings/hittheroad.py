# coding: utf-8
from .base import *

DATABASES = {
    'default': env.db_url('KPI_DATABASE_URL'),
    'kobocat': env.db_url('KC_DATABASE_URL'),
    'default_destination': env.db_url('KPI_DATABASE_URL_DESTINATION'),
    'kobocat_destination': env.db_url('KC_DATABASE_URL_DESTINATION'),
}
DATABASE_ROUTERS = ['kpi.db_routers.HitTheRoadDatabaseRouter']
