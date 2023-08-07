from django.contrib import admin
from django.contrib.auth.models import User, Group

from .extra_user_detail import ExtraUserDetailAdmin
from .extend_user import ExtendedUserAdmin
from ..models import (
    ExtraUserDetail,
    ConfigurationFile,
    SitewideMessage,
    PerUserSetting,
)


admin.site.register(ExtraUserDetail, ExtraUserDetailAdmin)
admin.site.register(SitewideMessage)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.unregister(Group)
admin.site.unregister(User)
admin.site.register(User, ExtendedUserAdmin)
