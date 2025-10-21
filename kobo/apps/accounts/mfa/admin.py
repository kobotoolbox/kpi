# coding: utf-8
from django.contrib import admin

from .models import (
    TrenchMFAMethod,
    MfaAvailableToUser,
    MfaAvailableToUserAdmin,
    ExtendedTrenchMfaMethod,
    ExtendedTrenchMfaMethodAdmin,
)

admin.site.unregister(TrenchMFAMethod)
admin.site.register(ExtendedTrenchMfaMethod, ExtendedTrenchMfaMethodAdmin)
admin.site.register(MfaAvailableToUser, MfaAvailableToUserAdmin)
