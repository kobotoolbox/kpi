from django.db.models import Q
from rest_framework import filters

from kpi.utils.object_permission import get_database_user


class InviteFilter(filters.BaseFilterBackend):

    SENDER_MODE = 'sender'
    RECIPIENT_MODE = 'recipient'

    def filter_queryset(self, request, queryset, view):
        mode = request.query_params.get('mode')
        user = get_database_user(request.user)

        if mode == self.SENDER_MODE:
            return queryset.filter(sender=user)
        elif mode == self.RECIPIENT_MODE:
            return queryset.filter(recipient=user)
        else:
            return queryset.filter(Q(sender=user) | Q(recipient=user))