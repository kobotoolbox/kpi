from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from ..filters import InviteFilter
from ..models import Invite
from ..serializers import InviteSerializer


class InviteViewSet(viewsets.ModelViewSet):

    model = Invite
    lookup_field = 'uid'
    serializer_class = InviteSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = (InviteFilter, )

    def get_queryset(self):

        queryset = self.model.objects.select_related('destination_user')
        return queryset
