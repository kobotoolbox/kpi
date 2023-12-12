from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from ..models import Transfer
from ..serializers import TransferSerializer


class TransferViewSet(viewsets.ReadOnlyModelViewSet):

    model = Transfer
    lookup_field = 'uid'
    serializer_class = TransferSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):

        queryset = (
            self.model.objects.all()
            .select_related('asset')
            .defer('asset__content')
            .prefetch_related('statuses')
        )
        return queryset
