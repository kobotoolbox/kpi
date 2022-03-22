from datetime import datetime, timezone
from django.utils.translation import gettext as t
from rest_framework import filters, serializers

from .constants import HOOK_LOG_FAILED, HOOK_LOG_PENDING, HOOK_LOG_SUCCESS


class HookLogFilter(filters.BaseFilterBackend):
    VALID_STATUSES = [HOOK_LOG_FAILED, HOOK_LOG_PENDING, HOOK_LOG_SUCCESS]

    def filter_queryset(self, request, queryset, view):
        status = request.GET.get('status')
        if status is not None:
            if status not in map(str, self.VALID_STATUSES):
                raise serializers.ValidationError(
                    {
                        'status': t(
                            'Value must be one of: '
                            + ', '.join(map(str, self.VALID_STATUSES))
                        )
                    }
                )
            else:
                queryset = queryset.filter(status=status)

        # Filter on date range
        start = request.GET.get('start')
        if start is not None:
            try:
                start_date = datetime.fromisoformat(start)
                if not start_date.tzname():
                    start_date = start_date.replace(tzinfo=timezone.utc)
                queryset = queryset.filter(date_modified__gte=start_date)
            except ValueError:
                raise serializers.ValidationError(
                    {'start': t('Value must be a valid ISO-8601 date')}
                )

        end = request.GET.get('end')
        if end is not None:
            try:
                end_date = datetime.fromisoformat(end)
                if not end_date.tzname():
                    end_date = end_date.replace(tzinfo=timezone.utc)
                queryset = queryset.filter(date_modified__lt=end_date)
            except ValueError:
                raise serializers.ValidationError(
                    {'end': t('Value must be a valid ISO-8601 date')}
                )

        return queryset
