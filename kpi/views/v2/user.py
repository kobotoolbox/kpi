from rest_framework import exceptions, mixins, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.filters import SearchFilter
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.user import UserListSerializer, UserSerializer
from kpi.tasks import sync_kobocat_xforms


class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    """
    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database
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
        """
        A temporary endpoint that allows superusers to migrate other users'
        projects, and users to migrate their own projects, from Kobocat to KPI.
        This is required while users transition from the legacy interface to
        the new.

        1. Call this endpoint with `?username=<username>`
        2. Fetch url provided to check the state of the Celery task.
           It can be:
            - 'PENDING'
            - 'FAILED'
            - 'SUCCESS'

        Notes: Be aware that the Celery `res.state` isn't too reliable, it
        returns 'PENDING' if task does not exist.

        """

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
                    'user-migrate',
                    kwargs={
                        'username': username,
                        'task_id': task.task_id
                    },
                    request=request
                )
            }
        )
