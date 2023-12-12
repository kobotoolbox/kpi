from django.db.models import Q
from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from kpi.utils.object_permission import get_database_user
from ..models import Invite
from ..serializers import InviteSerializer


class InviteViewSet(viewsets.ModelViewSet):

    model = Invite
    lookup_field = 'uid'
    serializer_class = InviteSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):

        queryset = self.model.objects.filter(
            Q(source_user=get_database_user(self.request.user))
            | Q(destination_user=get_database_user(self.request.user))
        ).select_related('destination_user')
        return queryset
