# coding: utf-8
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Q
from django.db.models.query import QuerySet
from django.http import Http404
from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.filters import (
    AssetOrderingFilter,
    SearchFilter,
)
from kpi.models import Asset, ProjectViewExportTask
from kpi.serializers.v2.asset import AssetMetadataListSerializer
from kpi.serializers.v2.user import UserListSerializer
from kpi.utils.project_views import (
    get_region_for_view,
    user_has_view_perms,
)
from kpi.tasks import project_view_export_in_background
from .models.project_view import ProjectView
from .serializers import ProjectViewSerializer


class ProjectViewViewSet(viewsets.ReadOnlyModelViewSet):

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
        return self.queryset.filter(users=self.request.user)

    @action(
        detail=True,
        methods=['GET'],
        filter_backends=[SearchFilter, AssetOrderingFilter],
    )
    def assets(self, request, uid):
        if not user_has_view_perms(request.user, uid):
            raise Http404
        assets = Asset.objects.all()
        queryset = self.filter_queryset(
            self._get_regional_queryset(assets, uid, _type='asset')
        )
        return self._get_regional_response(queryset, _type='asset')

    @action(
        detail=True,
        methods=['GET', 'POST'],
        url_path='(?P<_type>(assets|users))/export',
    )
    def export(self, request, uid, _type):
        user = request.user

        if not user_has_view_perms(user, uid):
            raise Http404

        if request.method == 'GET':
            export = ProjectViewExportTask.objects.filter(
                user=user, data__view=uid, data__type=_type
            ).last()
            if not export:
                return Response({})

            file_location = serializers.FileField().to_representation(
                export.result
            )
            return Response(
                {
                    'status': export.status,
                    'result': request.build_absolute_uri(file_location),
                }
            )
        elif request.method == 'POST':
            export_task = ProjectViewExportTask.objects.create(
                user=user,
                data={
                    'view': uid,
                    'type': _type,
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
            self._get_regional_queryset(users, uid, _type='user')
            .exclude(pk=settings.ANONYMOUS_USER_ID)
            .distinct()
            .order_by('id')
        )
        return self._get_regional_response(queryset, _type='user')

    def get_serializer_context(self):
        context_ = super().get_serializer_context()
        context_['request'] = self.request
        return context_

    def _get_regional_response(self, queryset, _type):
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self._get_regional_serializer(page, _type=_type)
            return self.get_paginated_response(serializer.data)
        serializer = self._get_regional_serializer(queryset, _type=_type)
        return Response(serializer.data)

    def _get_regional_serializer(self, queryset, _type):
        serializer = AssetMetadataListSerializer
        if _type == 'user':
            serializer = UserListSerializer
        return serializer(
            queryset,
            many=True,
            read_only=True,
            context=self.get_serializer_context(),
        )

    @staticmethod
    def _get_regional_queryset(
        queryset: QuerySet, uid: str, _type: str
    ) -> QuerySet:

        region = get_region_for_view(uid)

        if '*' in region:
            return queryset

        q_terms = {
            'asset': 'settings__country',
            'user': 'extra_details__data__country',
        }

        q = Q(**{f'{q_terms[_type]}__in': region})
        for country in region:
            q |= Q(**{f'{q_terms[_type]}__contains': [{'value': country}]})
        return queryset.filter(q)
