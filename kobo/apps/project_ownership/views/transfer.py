from django.shortcuts import Http404
from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from ..models import Transfer
from ..serializers import TransferDetailSerializer


class TransferViewSet(viewsets.ReadOnlyModelViewSet):

    model = Transfer
    lookup_field = 'uid'
    permission_classes = (IsAuthenticated,)
    serializer_class = TransferDetailSerializer

    def get_queryset(self):

        queryset = (
            self.model.objects.all()
            .select_related('asset')
            .defer('asset__content')
            .prefetch_related('statuses')
        )
        return queryset

    def list(self, request, *args, **kwargs):
        raise Http404()
