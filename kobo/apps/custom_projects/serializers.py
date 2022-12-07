# coding: utf-8
from __future__ import annotations

from rest_framework import serializers
from rest_framework.reverse import reverse

from .models.custom_project import CustomProject


class CustomProjectSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    countries = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    assets_export = serializers.SerializerMethodField()
    users = serializers.SerializerMethodField()
    users_export = serializers.SerializerMethodField()
    assigned_users = serializers.SerializerMethodField()

    class Meta:
        model = CustomProject
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

    def get_assets(self, obj) -> str:
        return reverse(
            'customproject-assets',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_assets_export(self, obj) -> str:
        return reverse(
            'customproject-export',
            args=(obj.uid, 'assets'),
            request=self.context.get('request', None),
        )

    def get_assigned_users(self, obj) -> List[str]:
        return obj.users.all().values_list('username', flat=True)

    def get_countries(self, obj) -> List[str]:
        return obj.get_countries()

    def get_users(self, obj) -> str:
        return reverse(
            'customproject-users',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_users_export(self, obj) -> str:
        return reverse(
            'customproject-export',
            args=(obj.uid, 'users'),
            request=self.context.get('request', None),
        )

    def get_url(self, obj) -> str:
        return reverse(
            'customproject-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
