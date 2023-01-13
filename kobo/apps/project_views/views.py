# coding: utf-8
from typing import Union

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Prefetch, Q
from django.db.models.query import QuerySet
from django.http import Http404
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import (
    AssetOrderingFilter,
    SearchFilter,
)
from kpi.mixins.object_permission import ObjectPermissionViewSetMixin
from kpi.models import Asset, ProjectViewExportTask, AssetVersion
from kpi.serializers.v2.asset import AssetMetadataListSerializer
from kpi.serializers.v2.user import UserListSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.project_views import (
    get_region_for_view,
    user_has_view_perms,
)
from kpi.tasks import project_view_export_in_background
from .models.project_view import ProjectView
from .serializers import ProjectViewSerializer


class ProjectViewViewSet(
    ObjectPermissionViewSetMixin, viewsets.ReadOnlyModelViewSet
):

    serializer_class = ProjectViewSerializer
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
    ]
    min_search_characters = 2
    ordering_fields = [
        'date_modified',
        'date_deployed',
        'name',
        'settings__sector__value',
        'settings__description',
        '_deployment_data__active',
        'owner__username',
        'owner__extra_details__data__name',
        'owner__extra_details__data__organization',
        'owner__email',
    ]
    queryset = ProjectView.objects.all()

    def get_queryset(self, *args, **kwargs):
        user = get_database_user(self.request.user)
        return self.queryset.filter(users=user)

    @action(
        detail=True,
        methods=['GET'],
        filter_backends=[SearchFilter, AssetOrderingFilter],
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
        ).prefetch_related(
            Prefetch(
                'asset_versions',
                queryset=AssetVersion.objects.order_by(
                    '-date_modified'
                ).only('uid', 'asset', 'date_modified', 'deployed'),
                to_attr='prefetched_latest_versions',
            ),
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
            project_view_export_in_background.delay(
                export_task_uid=export_task.uid,
                username=user.username,
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
            .distinct()
            .order_by('id')
        )

        return self._get_regional_response(
            queryset, serializer_class=UserListSerializer
        )

    def get_serializer_context(self):
        context_ = super().get_serializer_context()
        context_['request'] = self.request
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
        context_ = self.get_serializer_context()

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
            # FIXME, lines below are probably broken with SSO changes
            #   see kobo.apps.accounts.migrations.0001_initial.py
            q = Q()
            for country in region:
                q |= Q(
                    extra_details__data__country__contains=[{'value': country}]
                )
            return queryset.filter(q)
        else:
            return queryset.filter(settings__country_codes__in_array=region)
