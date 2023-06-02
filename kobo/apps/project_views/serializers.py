# coding: utf-8
from __future__ import annotations

from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.static_lists import COUNTRIES
from .models.project_view import ProjectView


class ProjectViewSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    countries = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
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
            'assets_export',
            'users',
            'users_export',
            'countries',
            'permissions',
            'assigned_users',
        )

    def get_assets(self, obj: ProjectView) -> list:
        return reverse(
            'projectview-assets',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_assets_export(self, obj: ProjectView) -> str:
        return reverse(
            'projectview-export',
            args=(obj.uid, 'assets'),
            request=self.context.get('request', None),
        )

    def get_assigned_users(self, obj: ProjectView) -> list[str]:
        return obj.users.all().values_list('username', flat=True)

    def get_countries(self, obj: ProjectView) -> list[str]:
        """
        Return a sorted list of country labels if it's available, otherwise the
        code entered for the country.
        """
        return sorted(dict(COUNTRIES).get(c, c) for c in obj.get_countries())

    def get_users(self, obj: ProjectView) -> list[str]:
        return reverse(
            'projectview-users',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_users_export(self, obj: ProjectView) -> str:
        return reverse(
            'projectview-export',
            args=(obj.uid, 'users'),
            request=self.context.get('request', None),
        )

    def get_url(self, obj: ProjectView) -> str:
        return reverse(
            'projectview-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
