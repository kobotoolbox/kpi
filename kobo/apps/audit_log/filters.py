from django_filters.rest_framework import DjangoFilterBackend


class AccessLogPermissionsFilter(DjangoFilterBackend):
    def filter_queryset(self, request, queryset, view):
        user = request.user
        return queryset.filter(user_uid=user.extra_details.uid)
