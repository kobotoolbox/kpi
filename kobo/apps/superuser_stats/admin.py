# coding: utf-8
import csv
from datetime import date
from dateutil.relativedelta import relativedelta

from django.contrib import admin, messages
from django.contrib.admin import DateFieldListFilter
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.http import HttpResponse

from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatXForm,
    ReadOnlyKobocatInstance,
)
from kpi.models.asset import Asset


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


class CountryFilter(admin.SimpleListFilter):
    title = 'Country'
    parameter_name = 'Country'

    def __init__(self, request, params, *args, **kwargs):
        super().__init__(request, params, None, None)

    def lookups(self, request, model_admin):
        return COUNTRIES

    def queryset(self, request, queryset):
        pass


class SubmissionsByCountry(admin.ModelAdmin):
    change_list_template = 'submissions_by_country.html'
    list_filter = (('date_created', DateFieldListFilter), CountryFilter)
    actions = None

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        response = super().changelist_view(
            request,
            extra_context=extra_context,
        )
        response.context_data['summary'] = self.__get_serialized_data(request)
        return response

    def __get_serialized_data(self, request) -> list:
        cl = self.get_changelist_instance(request)
        qs = cl.get_queryset(request)

        data = []

        country_filter = CountryFilter(
            request, request.GET.dict()
        )

        asset_queryset = Asset.objects.filter(
            asset_type=ASSET_TYPE_SURVEY
        )

        countries = COUNTRIES
        if country_filter.value():
            countries = [country for country in COUNTRIES if country[0] == country_filter.value()]

        # Filter for individual countries
        for code, name in countries:
            instances_count = 0
            assets = asset_queryset.filter(
                settings__country__value=code,
            )
            if assets.count() != 0:
                xform_id_strings = list(assets.values_list(
                    '_deployment_data__backend_response__id_string', flat=True
                ).filter(
                    _deployment_data__backend='kobocat',
                    asset_type=ASSET_TYPE_SURVEY,
                ))

                result = KobocatXForm.objects.filter(id_string__in=xform_id_strings).aggregate(
                    instances_count=Sum('num_of_submissions'))
                instances_count = result['instances_count']

            data.append({
                'country': name,
                'count': instances_count,
            })

        return data


class UserStatisticsAdmin(admin.ModelAdmin):
    change_list_template = 'user_statistics.html'
    list_filter = (TimePeriodFilter,)
    actions = None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        response = super().changelist_view(
            request,
            extra_context=extra_context,
        )
        response.context_data['summary'] = self.__get_serialized_data(request)
        return response

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

        # Filter the asset_queryset for active deployments
        asset_queryset = asset_queryset.filter(_deployment_data__active=True)
        records = asset_filter.queryset(request, asset_queryset).annotate(
            deployment_count=Count('pk')
        ).order_by()
        deployment_count = {
            record['owner_id']: record['deployment_count']
            for record in records
        }

        # Get records from SubmissionCounter
        records = (
            qs.values('user_id', 'user__username', 'user__date_joined')
            .order_by('user__date_joined')
            .annotate(count_sum=Sum('count'))
        )
        for record in records:
            data.append({
                'username': record['user__username'],
                'date_joined': record['user__date_joined'],
                'submission_count': record['count_sum'],
                'form_count': forms_count.get(record['user_id'], 0),
                'deployed_form_count': deployment_count.get(
                    record['user_id'], 0
                ),
            })

        return data


admin.site.register(KobocatSubmissionCounter, UserStatisticsAdmin)
admin.site.register(ReadOnlyKobocatInstance, SubmissionsByCountry)
