from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin

from models import SitewideMessage
from actions import delete_related_objects

class UserDeleteRelatedAdmin(UserAdmin):
    actions = [delete_related_objects]

admin.site.register(SitewideMessage)
admin.site.unregister(User)
admin.site.register(User, UserDeleteRelatedAdmin)
