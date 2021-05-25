# coding: utf-8
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from kpi.deployment_backends.kc_access.utils import delete_kc_users
from .models import SitewideMessage, ConfigurationFile, PerUserSetting


class UserDeleteAdmin(UserAdmin):
    """
    Deleting users used to a two-step process since KPI and KoBoCAT
    shared the same database, but it's not the case anymore.
    See https://github.com/kobotoolbox/kobocat/issues/92#issuecomment-158219885

    It still implies to delete records in both databases. If users are
    deleted in KPI database but not in KoboCAT database, they will receive a
    500 error if they try to recreate an account with a previously deleted
    username.

    First, all KPI objects related to the user should be removed.
    Then, KoBoCAT objects related to the user (in KoBoCAT database) except
    `XForm` and `Instance`. We do not want to delete data without owner's
    permission

    """

    def delete_queryset(self, request, queryset):
        """
        Override `ModelAdmin.delete_queryset` to bulk delete users in KPI and KC
        """
        deleted_pks = list(queryset.values_list('pk', flat=True))
        # Delete users in KPI database first
        super().delete_queryset(request, queryset)

        if not delete_kc_users(deleted_pks):
            # Unfortunately, this message does not supersede Django message
            # when users are successfully deleted.
            # See https://github.com/django/django/blob/b9cf764be62e77b4777b3a75ec256f6209a57671/django/contrib/admin/actions.py#L41-L43
            # Maybe it still makes sense because KPI users are deleted.
            self.message_user(
                request,
                'Could not delete users in KoBoCAT database. They may own '
                'projects and/or submissions. Log into KoBoCAT admin '
                'interface and delete them from there.',
                messages.ERROR
            )

    def delete_model(self, request, obj):
        """
        Override `ModelAdmin.delete_model()` to delete user in KPI and KC
        """
        deleted_pk = obj.pk
        # Delete users in KPI database first.
        super().delete_model(request, obj)

        # This part could be in a post-delete signal but we would not catch
        # errors if any.
        # Moreover, users can be only deleted from the admin interface or from
        # the shell. We assume that power users who use shell can also call
        # `delete_kc_users()` manually.
        if not delete_kc_users([deleted_pk]):
            # Unfortunately, this message does not supersede Django message
            # when a user is successfully deleted.
            # See https://github.com/django/django/blob/b9cf764be62e77b4777b3a75ec256f6209a57671/django/contrib/admin/options.py#L1444-L1451
            # Maybe it still makes sense because KPI user is deleted.
            self.message_user(
                request,
                'Could not delete user in KoBoCAT database. They may own '
                'projects and/or submissions. Log into KoBoCAT admin '
                'interface and delete them from there.',
                messages.ERROR
            )


admin.site.register(SitewideMessage)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.unregister(User)
admin.site.register(User, UserDeleteAdmin)
