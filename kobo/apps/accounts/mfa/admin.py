# coding: utf-8
from django.contrib import admin

from .models import (
    ExtendedTrenchMfaMethodAdmin,
    MfaAvailableToUser,
    MfaAvailableToUserAdmin,
    MfaMethod,
    TrenchMFAMethod,
)

admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethod, ExtendedTrenchMfaMethodAdmin)
admin.site.register(MfaAvailableToUser, MfaAvailableToUserAdmin)
