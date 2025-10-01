from django.db.models import Prefetch
from django.shortcuts import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from ..models import Transfer, TransferStatus
from ..schema_extensions.v2.project_ownership.transfers.serializers import (
    TransferListResponse,
)
from ..serializers import TransferDetailSerializer


@extend_schema(
    tags=['Manage projects and library content'],
    parameters=[
        OpenApiParameter(
            name='parent_lookup_invite_uid',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent invite',
        ),
    ],
)
@extend_schema_view(
    list=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(
        description=read_md('project_ownership', 'transfers/retrieve.md'),
        responses=open_api_200_ok_response(
            TransferListResponse,
            validate_payload=False,
        ),
    ),
)
class TransferViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for transfers

    Available actions:
    - list           → GET       /api/v2/project-ownership/invites/{parent_lookup_invite_uid}/transfers/  # noqa
    - retrieve       → GET       /api/v2/project-ownership/invites/{parent_lookup_invite_uid}/transfers/{uid}/  # noqa

    Documentation:
    - docs/api/v2/transfers/list.md
    - docs/api/v2/transfers/retrieve.md
    """

    model = Transfer
    lookup_field = 'uid'
    permission_classes = (IsAuthenticated,)
    serializer_class = TransferDetailSerializer

    def get_queryset(self):

        queryset = (
            self.model.objects.all()
            .select_related('asset')
            .only('asset__uid')
            .prefetch_related(
                Prefetch(
                    'statuses',
                    queryset=TransferStatus.objects.all(),
                    to_attr='prefetched_statuses',
                )
            )
        )

        return queryset

    def list(self, request, *args, **kwargs):
        raise Http404()
