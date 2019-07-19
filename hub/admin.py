from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin

from models import SitewideMessage, ConfigurationFile, PerUserSetting
from actions import delete_related_objects, remove_from_kobocat

class UserDeleteKludgeAdmin(UserAdmin):
    '''
    Deleting users is, sadly, a two-step process since KPI and KoBoCAT share
    the same database but do not know about each other's models.

    First, all KPI objects related to the user should be removed:
    `delete_related_objects` accomplishes this. With only the user object
    itself and related KoBoCAT objects remaining, the standard Django deletion
    machinery in KoBoCAT should succeed. `remove_from_kobocat` helps the
    superuser invoke that.

    See https://github.com/kobotoolbox/kobocat/issues/92#issuecomment-158219885
    '''

    actions = [delete_related_objects, remove_from_kobocat]

    def get_actions(self, request):
        '''
        Remove the standard "Delete selected users" action, since it will
        almost always fail
        '''

        actions = super(UserDeleteKludgeAdmin, self).get_actions(request)
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions


admin.site.register(SitewideMessage)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.unregister(User)
admin.site.register(User, UserDeleteKludgeAdmin)
