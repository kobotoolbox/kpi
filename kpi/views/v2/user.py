from django.conf import settings
from django.db.models import Count
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import exceptions, mixins, status, viewsets
from rest_framework.decorators import action
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
    tags=['User / team / organization / usage'],
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
class UserViewSet(
    viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin
):
    """
    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database

    Available actions:
    - list          → GET     /api/v2/users/
    - retrieve      → GET     /api/v2/users/{username}/
    - migrate       → GET     /api/v2/users/{username}/migrate/

    Documentation:
    - docs/api/v2/users/list.md
    - docs/api/v2/users/retrieve.md
    - docs/api/v2/users/migrate.md
    """

    filter_backends = (SearchFilter,)
    serializer_class = UserSerializer
    lookup_field = 'username'
    permission_classes = (IsAuthenticated,)
    search_default_field_lookups = [
        'username__icontains',
    ]

    class Meta:
        model = Asset
        fields = '__all__'

    def get_queryset(self, *args, **kwargs):
        self.queryset = User.objects.all()

        if not self.request.user.is_superuser:
            self.queryset = self.queryset.filter(is_active=True)

        if self.action == 'list':
            self.queryset = (
                self.queryset.exclude(pk=settings.ANONYMOUS_USER_ID)
                .select_related('extra_details')
                .order_by('id')
            )

        return self.queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        else:
            return UserSerializer

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise exceptions.PermissionDenied()

        return super().list(request, *args, **kwargs)

    def paginate_queryset(self, queryset):
        if not (page := super().paginate_queryset(queryset)):
            return None

        user_ids = (user.pk for user in page)
        counts_map = {
            asset['owner_id']: asset['assets_count']
            for asset in (
                Asset.objects.filter(owner_id__in=user_ids)
                .values('owner_id')
                .annotate(assets_count=Count('id'))
            )
        }

        def _page_generator():
            # Inject and yield on-the-fly assets count
            for user in page:
                user.assets_count = counts_map.get(user.pk, 0)
                yield user

        return _page_generator()

    @action(detail=True, methods=['GET'],
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
