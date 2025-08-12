from rest_framework import exceptions, mixins, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.filters import SearchFilter
from kpi.paginators import LimitStartPagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.user import UserListSerializer, UserSerializer
from kpi.tasks import sync_kobocat_xforms


class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    """
    This endpoint allows interaction with user profiles. It provides
    read access to individual user details and, for superusers, a list of all
    users.

    ---

    ### List Users

    Only available to superusers.

    <pre class="prettyprint">
    <b>GET</b> /users/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/users/

    > Response 200

    >       {
    >           "count": int,
    >           "next": string,
    >           "previous": string,
    >           "results": [
    >               {
    >                   "extra_details__uid": string,
    >                   "username": string,
    >                   "first_name": string,
    >                   "last_name": string,
    >                   "email": string,
    >                   "is_superuser": boolean,
    >                   "is_staff": boolean,
    >                   "is_active": boolean,
    >                   "date_joined": "YYYY-MM-DDTHH:MM:SSZ",
    >                   "last_login": "YYYY-MM-DDTHH:MM:SSZ",
    >                   "validated_email": boolean,
    >                   "validated_password": boolean,
    >                   "mfa_is_active": boolean,
    >                   "sso_is_active": boolean,
    >                   "accepted_tos": boolean,
    >                   "social_accounts": [
    >                       {
    >                           "provider": string,
    >                           "uid": string,
    >                           "last_login": "YYYY-MM-DDTHH:MM:SSZ",
    >                           "date_joined": "YYYY-MM-DDTHH:MM:SSZ",
    >                           "email": string,
    >                           "username": string
    >                       }
    >                   ],
    >                   "organizations": {
    >                       "organization_name": string,
    >                       "organization_uid": string,
    >                       "role": string
    >                   },
    >                   "metadata": {
    >                       "bio": string,
    >                       "city": string,
    >                       "name": string,
    >                       "gender": string,
    >                       "sector": string,
    >                       "country": string,
    >                       "twitter": string,
    >                       "linkedin": string,
    >                       "instagram": string,
    >                       "organization": string,
    >                       "require_auth": string,
    >                       "last_ui_language": string,
    >                       "organization_type": string,
    >                       "organization_website": string,
    >                       "newsletter_subscription": string
    >                   },
    >                   "subscriptions": [],
    >                   "current_service_usage": {
    >                       "total_nlp_usage": {
    >                           "asr_seconds_current_period": integer,
    >                           "asr_seconds_all_time": integer,
    >                           "mt_characters_current_period": integer,
    >                           "mt_characters_all_time": integer,
    >                       },
    >                       "total_storage_bytes": integer,
    >                       "total_submission_count": {
    >                           "current_period": integer,
    >                           "all_time": integer,
    >                       },
    >                       "balances": {
    >                           "asr_seconds": {
    >                               "effective_limit": integer,
    >                               "balance_value": integer,
    >                               "balance_percent": integer,
    >                               "exceeded": boolean,
    >                           },
    >                           "mt_characters": {
    >                               "effective_limit": integer,
    >                               "balance_value": integer,
    >                               "balance_percent": integer,
    >                               "exceeded": boolean,
    >                           },
    >                           "storage_bytes": {
    >                               "effective_limit": integer,
    >                               "balance_value": integer,
    >                               "balance_percent": integer,
    >                               "exceeded": boolean,
    >                           },
    >                           "submission": {
    >                               "effective_limit": integer,
    >                               "balance_value": integer,
    >                               "balance_percent": integer,
    >                               "exceeded": boolean,
    >                           }
    >                       },
    >                       "current_period_start": YYYY-MM-DDTHH:MM:SSZ,
    >                       "current_period_end": YYYY-MM-DDTHH:MM:SSZ,
    >                       "last_updated": YYYY-MM-DDTHH:MM:SSZ
    >                   }
    >                   "asset_count": integer,
    >                   "deployed_asset_count": integer
    >               }
    >           ]
    >       }

    This endpoint is paginated and accepts these parameters:

    - `start`: The initial index from which to return the users
    - `limit`: Number of users to return per page

    ---

    ### Retrieve User Details

    <pre class="prettyprint">
    <b>GET</b> /users/{username}/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/users/user1/

    > Response 200

    >       {
    >           "url": "https://[kpi]/users/user1/",
    >           "username": string,
    >           "date_joined": YYYY-MM-DDTHH:MM:SSZ,
    >           "public_collection_subscribers_count": int,
    >           "public_collections_count": int
    >       }

    ### Current User Endpoint
    """

    queryset = User.objects.all()
    filter_backends = (SearchFilter,)
    serializer_class = UserSerializer
    lookup_field = 'username'
    pagination_class = LimitStartPagination
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
