# coding: utf-8
from django.contrib import admin

from hub.models import ExtraUserDetail
from .models import AuthorizedApplication
# from .deployment_backends.kc_access.shadow_models import KobocatSubmissionCounter

# Register your models here.
admin.site.register(AuthorizedApplication)
admin.site.register(ExtraUserDetail)
# admin.site.register(KobocatSubmissionCounter)
