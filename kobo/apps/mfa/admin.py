# coding: utf-8
from django.contrib import admin

from .models import (
    TrenchMFAMethod,
    MfaAvailableToUser,
    MfaAvailableToUserAdmin,
    MfaMethod,
    MfaMethodAdmin,
)

admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethod, MfaMethodAdmin)
admin.site.register(MfaAvailableToUser, MfaAvailableToUserAdmin)
