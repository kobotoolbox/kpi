from django.contrib import admin


class BaseAdvancedSearchFilter(admin.filters.SimpleListFilter):

    title = 'Advanced search'
    parameter_name = 'q'

    def lookups(self, request, model_admin):
        return (),

    def queryset(self, request, queryset):
        return None

    def choices(self, changelist):
        return (),


class PasswordValidationAdvancedSearchFilter(BaseAdvancedSearchFilter):

    template = 'admin/password_validation_advanced_search_filter.html'


class UserAdvancedSearchFilter(BaseAdvancedSearchFilter):

    template = 'admin/user_advanced_search_filter.html'
