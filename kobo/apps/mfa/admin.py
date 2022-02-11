# coding: utf-8
from django.contrib import admin

from .models import (
    MFAMethod,
    KoboMFAMethod,
    KoboMFAMethodAdmin,
)

admin.site.unregister(MFAMethod)
admin.site.register(KoboMFAMethod, KoboMFAMethodAdmin)
