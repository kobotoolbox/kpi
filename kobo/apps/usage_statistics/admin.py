import csv

from django.contrib import admin, messages
from django.contrib.admin import DateFieldListFilter
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.http import HttpResponse

from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatInstance,
    ReadOnlyKobocatXForm,
)
from kpi.models.asset import Asset

# class StartDateFilter(admin.SimpleListFilter):
#     title = 'Start Date'
#     parameter_name = 'start_date'

#     def __init__(self, request, params, model, model_admin):
#         super().__init__(request, params, model, model_admin)
#         self.__model = model

#     def lookups(self, request, model_admin):
#         return

#     def queryset(self, request, queryset):
#         return queryset


# class EndDateFilter(admin.SimpleListFilter):
#     title = 'End Date'
#     parameter_name = 'end_date'

#     def __init__(self, request, params, model, model_admin):
#         super().__init__(request, params, model, model_admin)
#         self.model = model

#     def lookups(self, request, model_admin):
#         return

#     def queryset(self, request, queryset):
#         return queryset

class CountryFilter(admin.SimpleListFilter):
    title = 'Country'
    parameter_name = 'Country'

    def __init__(self, request, params, model, model_admin):
        super().__init__(request, params, model, model_admin)
        self.__model = model

    def lookups(self, request, model_admin):
        return COUNTRIES

    def queryset(self, request, queryset):
        if not self.value():
            return queryset

        country = self.value()
        return queryset.filter(settings__country__value=country)


class SubmissionsByCountry(admin.ModelAdmin):
    change_list_template = 'submissions_by_country.html'
    list_filter = (('date_created', DateFieldListFilter), CountryFilter)
    actions = None

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

        asset_filter = CountryFilter(
            request, request.GET.dict(), Asset, self.__class__
        )

        for country in COUNTRIES:
            name = country[1]
            assets = qs.filter(
                asset_type=ASSET_TYPE_SURVEY,
                settings__country__label=str(name),
            )
            count = 0
            
            if assets.count() is not 0:

                for asset in assets:
                    form = ReadOnlyKobocatXForm.objects.get(id_string=asset.uid)
                    count += ReadOnlyKobocatInstance.objects.filter(xform=form).count()

                data.append({
                    'country': name,
                    'count': count,
                })

        return data


admin.site.register(Asset, SubmissionsByCountry)
