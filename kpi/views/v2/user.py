from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import exceptions, mixins, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.filters import SearchFilter
from kpi.models.asset import Asset
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.users.serializers import (
    UserListResponse,
    UserRetrieveResponse,
)
from kpi.serializers.v2.user import UserListSerializer, UserSerializer
from kpi.tasks import sync_kobocat_xforms
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(
    tags=['Users'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'users/list.md'),
        responses=open_api_200_ok_response(
            UserListResponse,
            require_auth=False,
            raise_not_found=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'users/retrieve.md'),
        responses=open_api_200_ok_response(
            UserRetrieveResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    migrate=extend_schema(
        exclude=True,
    ),
)
class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    """
    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database

    Available actions:
    - list          → GET     /api/v2/users/
    - retrieve      → GET     /api/v2/users/{username}/
    - migrate       → GET     /api/v2/users/{username}/migrate/

    Documentation:
    - docs/api/v2/users/list.md
    - docs/api/v2/organizations/retrieve.md
    - docs/api/v2/organizations/migrate.md
    """

    queryset = User.objects.all()
    filter_backends = (SearchFilter,)
    serializer_class = UserSerializer
    lookup_field = 'username'
    pagination_class = LimitOffsetPagination
    permission_classes = (IsAuthenticated,)
    search_default_field_lookups = [
        'username__icontains',
    ]

    class Meta:
        model = Asset
        fields = '__all__'

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        else:
            return UserSerializer

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise exceptions.PermissionDenied()

        filtered_queryset = self.filter_queryset(self.queryset).order_by('id')
        page = self.paginate_queryset(filtered_queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['GET'],
            renderer_classes=[renderers.JSONRenderer],
            url_path=r'migrate(?:/(?P<task_id>[\d\w\-]+))?')
    def migrate(self, request, task_id: str = None, **kwargs):
        request_user = request.user
        migrate_user = kwargs.get('username')
        if request_user.is_anonymous or (
            not request_user.is_superuser
            and request_user.username != migrate_user
        ):
            raise exceptions.PermissionDenied()

        if task_id:
            from celery.result import AsyncResult
            res = AsyncResult(task_id)
            if res:
                return Response({'status': res.state})
            else:
                return Response(
                    {'detail': 'Unknown task_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        username = kwargs['username']

        task = sync_kobocat_xforms.delay(
            username=username,
            quiet=True,
            populate_xform_kpi_asset_uid=True,
            sync_kobocat_form_media=True
        )

        return Response(
            {
                'celery_task': reverse(
                    'user-kpi-migrate',
                    kwargs={
                        'username': username,
                        'task_id': task.task_id
                    },
                    request=request
                )
            }
        )
