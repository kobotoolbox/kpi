# coding: utf-8
from django.contrib.admin.apps import AdminConfig


class NoLoginAdminConfig(AdminConfig):

    default_site = 'kobo.apps.admin.admin.NoLoginAdminSite'
