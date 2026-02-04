from django_filters import rest_framework as filters

from .models import HookLog


class HookLogFilter(filters.FilterSet):
    start_date = filters.IsoDateTimeFilter(
        field_name='date_modified', lookup_expr='gte'
    )
    end_date = filters.IsoDateTimeFilter(field_name='date_modified', lookup_expr='lt')

    class Meta:
        model = HookLog
        fields = ['status', 'start_date', 'end_date']
