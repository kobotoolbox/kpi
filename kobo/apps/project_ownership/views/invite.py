from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.renderers import JSONRenderer

from kpi.permissions import IsAuthenticated
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response, \
    open_api_201_created_response, open_api_204_empty_response
from ..schema_extensions.v2.project_ownership.invites.serializers import InviteResponse, \
    InviteCreatePayload, InviteUpdatePayload
from ...audit_log.base_views import AuditLoggedModelViewSet
from ..filters import InviteFilter
from ..models import Invite
from ..serializers import InviteSerializer


@extend_schema(
    tags=['Project Ownership Invites'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('project_ownership', 'project_ownership/invites/create.md'),
        request={'application/json': InviteCreatePayload},
        responses=open_api_201_created_response(
            InviteResponse,
            require_auth=False,
            raise_not_found=False,
        )
    ),
    destroy=extend_schema(
        description=read_md('project_ownership', 'project_ownership/invites/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('project_ownership', 'project_ownership/invites/list.md'),
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
            raise_not_found=False,
            validate_payload=False,
        )
    ),
    retrieve=extend_schema(
        description=read_md('project_ownership', 'project_ownership/invites/retrieve.md'),
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
            validate_payload=False,
        )
    ),
    partial_update=extend_schema(
        description=read_md('project_ownership', 'project_ownership/invites/update.md'),
        request={'application/json': InviteUpdatePayload},
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
        )
    ),
    update=extend_schema(
        exclude=True,
    )
)
class InviteViewSet(AuditLoggedModelViewSet):
    """
    Viewset for managing project invites

    Available actions:
    - create            → GET     /api/v2/project-ownership/invites/
    - destroy           → GET     /api/v2/project-ownership/invites/{guid}/
    - list              → GET     /api/v2/project-ownership/invites/
    - retrieve          → GET     /api/v2/project-ownership/invites/{guid}/
    - partial_update    → GET     /api/v2/project-ownership/invites/{guid}/

    Documentation:
    - docs/api/v2/project_ownership/invites/create.md
    - docs/api/v2/project_ownership/invites/delete.md
    - docs/api/v2/project_ownership/invites/list.md
    - docs/api/v2/project_ownership/invites/retrieve.md
    - docs/api/v2/project_ownership/invites/update.md
    """

    model = Invite
    lookup_field = 'uid'
    serializer_class = InviteSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = (InviteFilter, )
    log_type = 'project-history'
    logged_fields = ['recipient.username', 'status', 'transfers']
    renderer_classes = [JSONRenderer,]

    def get_queryset(self):

        queryset = (
            self.model.objects
            .select_related('sender')
            .select_related('recipient')
        )

        return queryset
