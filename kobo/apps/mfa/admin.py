# coding: utf-8
from django.contrib import admin

from .models import (
    MFAMethod,
    KoboMFAPerUserActivation,
    KoboMFAPerUserActivationAdmin,
    KoboMFAMethod,
    KoboMFAMethodAdmin,
)

admin.site.unregister(MFAMethod)
admin.site.register(KoboMFAMethod, KoboMFAMethodAdmin)
admin.site.register(KoboMFAPerUserActivation, KoboMFAPerUserActivationAdmin)
