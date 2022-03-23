from django_filters import rest_framework as filters
from .models import HookLog


class HookLogFilter(filters.FilterSet):
    start = filters.IsoDateTimeFilter(
        field_name='date_modified', lookup_expr='gte')
    end = filters.IsoDateTimeFilter(
        field_name='date_modified', lookup_expr='lt')

    class Meta:
        model = HookLog
        fields = ['status', 'start', 'end']
