# coding: utf-8
from django.contrib import admin

from .models import (
    MFAMethod,
    KoboMFAActiveUser,
    KoboMFAActiveUserAdmin,
    KoboMFAMethod,
    KoboMFAMethodAdmin,
)

admin.site.unregister(MFAMethod)
admin.site.register(KoboMFAMethod, KoboMFAMethodAdmin)
admin.site.register(KoboMFAActiveUser, KoboMFAActiveUserAdmin)
