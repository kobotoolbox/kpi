# coding: utf-8
from __future__ import annotations

from django.db.models import Q
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.models import Asset
from kpi.utils.project_views import (
    get_region_for_view,
)
from .models.project_view import ProjectView


class ProjectViewSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    countries = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    assets_count = serializers.SerializerMethodField()
    assets_export = serializers.SerializerMethodField()
    users = serializers.SerializerMethodField()
    users_export = serializers.SerializerMethodField()
    assigned_users = serializers.SerializerMethodField()

    class Meta:
        model = ProjectView
        fields = (
            'uid',
            'name',
            'url',
            'assets',
            'assets_count',
            'assets_export',
            'users',
            'users_export',
            'countries',
            'permissions',
            'assigned_users',
        )

    def get_assets(self, obj) -> str:
        return reverse(
            'projectview-assets',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_assets_count(self, obj) -> str:
        region = get_region_for_view(obj.uid)
        queryset = Asset.objects.all()

        if '*' in region:
            return queryset.count()

        q = Q(settings__country__in=region)
        for country in region:
            q |= Q(settings__country__contains=[{'value': country}])
        return queryset.filter(q).count()

    def get_assets_export(self, obj) -> str:
        return reverse(
            'projectview-export',
            args=(obj.uid, 'assets'),
            request=self.context.get('request', None),
        )

    def get_assigned_users(self, obj) -> List[str]:
        return obj.users.all().values_list('username', flat=True)

    def get_countries(self, obj) -> List[str]:
        return obj.get_countries()

    def get_users(self, obj) -> str:
        return reverse(
            'projectview-users',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_users_export(self, obj) -> str:
        return reverse(
            'projectview-export',
            args=(obj.uid, 'users'),
            request=self.context.get('request', None),
        )

    def get_url(self, obj) -> str:
        return reverse(
            'projectview-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
