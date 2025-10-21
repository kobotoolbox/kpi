# coding: utf-8
from django.contrib import admin

from .models import (
    TrenchMFAMethod,
    MfaAvailableToUser,
    MfaAvailableToUserAdmin,
    MfaMethod,
    ExtendedTrenchMfaMethodAdmin,
)

admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethod, ExtendedTrenchMfaMethodAdmin)
admin.site.register(MfaAvailableToUser, MfaAvailableToUserAdmin)
