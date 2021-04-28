# coding: utf-8
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils.translation import gettext as _

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.utils import delete_kc_users
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatUser,
)
from kpi.models.asset import Asset
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
                _('Could not delete users in KoBoCAT database. They may own '
                  'projects and/or submissions. Log into KoBoCAT admin '
                  'interface and delete them from there.'),
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
                _('Could not delete user in KoBoCAT database. They may own '
                  'projects and/or submissions. Log into KoBoCAT admin '
                  'interface and delete them from there.'),
                messages.ERROR
            )


class TimePeriodFilter(admin.SimpleListFilter):
    title = 'Period Filters'
    parameter_name = 'timeframe'

    def __init__(self, request, params, model, model_admin):
        super().__init__(request, params, model, model_admin)
        self.__model = model

    def lookups(self, request, model_admin):
        return (
            ('1', '1 Month'),
            ('3', '3 Months'),
            ('6', '6 Months'),
            ('9', '9 Months'),
            ('12', '12 Months'),
        )

    def queryset(self, request, queryset):
        if not self.value():
            return queryset

        # minus one so that it includes the current
        # month when retrieving data and not pull
        # the data from an extra month earlier
        months = int(self.value()) - 1
        today = date.today()
        first_day_month = today.replace(day=1)
        from_date = first_day_month - relativedelta(months=months)

        if self.__model == Asset:
            condition = {'date_created__gte': from_date}
        else:
            condition = {'timestamp__gte': from_date}

        return queryset.filter(**condition)


class UserStatisticsAdmin(admin.ModelAdmin):
    change_list_template = 'user_statistics.html'
    list_filter = (TimePeriodFilter,)
    actions = None

    def __get_serialized_data(self, request) -> list:
        cl = self.get_changelist_instance(request)
        qs = cl.get_queryset(request)

        data = []

        # Filter the assets for the counter
        asset_filter = TimePeriodFilter(
            request, request.GET.dict(), Asset, self.__class__
        )
        asset_queryset = Asset.objects.values('owner_id').filter(
            asset_type=ASSET_TYPE_SURVEY
        )
        records = asset_filter.queryset(request, asset_queryset).annotate(
            form_count=Count('pk')
        ).order_by()
        forms_count = {
            record['owner_id']: record['form_count'] for record in records
        }

        # Filter the asset_queryset for active deployements
        asset_queryset.filter(_deployment_data__active=True)
        records = asset_filter.queryset(request, asset_queryset).annotate(
            deployment_count=Count('pk')
        )
        deployment_count = {
            record['owner_id']: record['deployment_count']
            for record in records
        }

        # Get records from SubmissionCounter
        records = (
            qs.values('user_id', 'user__username')
            .order_by('user__username')
            .annotate(count_sum=Sum('count'))
        )
        for record in records:
            data.append({
                'pk': record['user_id'],
                'username': record['user__username'],
                'submission_count': record['count_sum'],
                'form_count': forms_count.get(record['user_id'], 0),
                'deployed_form_count': deployment_count.get(
                    record['user_id'], 0
                ),
            })

        return data


admin.site.register(SitewideMessage)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.unregister(User)
admin.site.register(User, UserDeleteAdmin)
admin.site.register(KobocatSubmissionCounter, UserStatisticsAdmin)
