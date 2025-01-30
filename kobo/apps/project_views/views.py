from typing import Optional, Union

from django.conf import settings
from django.db import transaction
from django.db.models.query import QuerySet
from django.http import Http404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.mixins.asset import AssetViewSetListMixin
from kpi.mixins.object_permission import ObjectPermissionViewSetMixin
from kpi.models import Asset, ProjectViewExportTask
from kpi.paginators import FastAssetPagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.asset import AssetMetadataListSerializer
from kpi.serializers.v2.user import UserListSerializer
from kpi.tasks import export_task_in_background
from kpi.utils.object_permission import get_database_user
from kpi.utils.project_views import get_region_for_view, user_has_view_perms
from .models.project_view import ProjectView
from .serializers import ProjectViewSerializer


class ProjectViewViewSet(
    AssetViewSetListMixin, ObjectPermissionViewSetMixin, viewsets.ReadOnlyModelViewSet
):

    serializer_class = ProjectViewSerializer
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
    ]
    min_search_characters = 2
    ordering_fields = AssetOrderingFilter.DEFAULT_ORDERING_FIELDS
    queryset = ProjectView.objects.all()

    def get_queryset(self, *args, **kwargs):
        user = get_database_user(self.request.user)
        return self.queryset.filter(users=user)

    @action(
        detail=True,
        methods=['GET'],
        filter_backends=[SearchFilter, AssetOrderingFilter],
        pagination_class=FastAssetPagination,
    )
    def assets(self, request, uid):
        if not user_has_view_perms(request.user, uid):
            raise Http404
        assets = Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY).defer(
            'content',
            'report_styles',
            'report_custom',
            'map_styles',
            'map_custom',
            'advanced_features',
            'known_cols',
            'data_sharing',
            'paired_data',
        )
        queryset = self.filter_queryset(
            self._get_regional_queryset(assets, uid, obj_type='asset')
        ).select_related(
            'owner', 'owner__extra_details'
        )
        return self._get_regional_response(
            queryset, serializer_class=AssetMetadataListSerializer
        )

    @action(
        detail=True,
        methods=['GET', 'POST'],
        url_path='(?P<obj_type>(assets|users))/export',
    )
    def export(self, request, uid, obj_type):
        user = request.user

        if not user_has_view_perms(user, uid):
            raise Http404

        if request.method == 'GET':
            export = ProjectViewExportTask.objects.filter(
                user=user, data__view=uid, data__type=obj_type
            ).last()
            if not export:
                return Response({})

            res = {'status': export.status}
            if export.result:
                res['result'] = request.build_absolute_uri(export.result.url)
            return Response(res)
        elif request.method == 'POST':
            export_task = ProjectViewExportTask.objects.create(
                user=user,
                data={
                    'view': uid,
                    'type': obj_type,
                },
            )

            # Have Celery run the export in the background
            transaction.on_commit(
                lambda: export_task_in_background.delay(
                    export_task_uid=export_task.uid,
                    username=user.username,
                    export_task_name='kpi.ProjectViewExportTask',
                )
            )

            return Response({'status': export_task.status})

    @action(detail=True, methods=['GET'])
    def users(self, request, uid):
        if not user_has_view_perms(request.user, uid):
            raise Http404
        users = User.objects.all()
        queryset = self.filter_queryset(
            self._get_regional_queryset(users, uid, obj_type='user')
            .exclude(pk=settings.ANONYMOUS_USER_ID)
            .select_related('extra_details')
            .order_by('id')
        )

        return self._get_regional_response(
            queryset, serializer_class=UserListSerializer
        )

    def get_serializer_context(self, data: Optional[list] = None):
        context_ = super().get_serializer_context()
        context_['request'] = self.request
        if not data:
            return context_

        asset_ids = [asset.pk for asset in data]
        context_['organizations_per_asset'] = (
            self.get_organizations_per_asset_ids(asset_ids)
        )

        return context_

    def _get_regional_response(self, queryset, serializer_class):
        self.__filtered_queryset = queryset

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self._get_regional_serializer(
                page, serializer_class=serializer_class
            )
            return self.get_paginated_response(serializer.data)

        serializer = self._get_regional_serializer(
            queryset, serializer_class=serializer_class
        )
        return Response(serializer.data)

    def _get_regional_serializer(
        self,
        queryset: QuerySet,
        serializer_class: Union[
            AssetMetadataListSerializer, UserListSerializer
        ],
    ):
        context_ = self.get_serializer_context(queryset)

        return serializer_class(
            queryset,
            many=True,
            read_only=True,
            context=context_,
        )

    @staticmethod
    def _get_regional_queryset(
        queryset: QuerySet, uid: str, obj_type: str
    ) -> QuerySet:

        region = get_region_for_view(uid)

        if '*' in region:
            return queryset

        if obj_type == 'user':
            return queryset.filter(extra_details__data__country__in=region)
        else:
            return queryset.filter(settings__country_codes__in_array=region)
