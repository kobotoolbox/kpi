# coding: utf-8
from django.contrib import admin

from .models import (
    MfaAvailableToUser,
    MfaAvailableToUserAdmin,
    MfaMethod,
)

admin.site.register(MfaAvailableToUser, MfaAvailableToUserAdmin)
