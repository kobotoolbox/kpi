from django.contrib import admin
from django.contrib.auth.models import Group

from kobo.apps.kobo_auth.shortcuts import User
from .extra_user_detail import ExtraUserDetailAdmin
from .extend_user import ExtendedUserAdmin
from .password_validation import PasswordValidationAdmin
from .sitewide_message import SitewideMessageAdmin
from ..models import (
    ExtraUserDetail,
    ConfigurationFile,
    SitewideMessage,
    PerUserSetting,
    PasswordValidation
)

admin.site.register(ExtraUserDetail, ExtraUserDetailAdmin)
admin.site.register(SitewideMessage, SitewideMessageAdmin)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.register(PasswordValidation, PasswordValidationAdmin)
admin.site.unregister(Group)
admin.site.register(User, ExtendedUserAdmin)
