# coding: utf-8
from __future__ import annotations

from rest_framework import serializers
from rest_framework.reverse import reverse

from .models.region import Region


class RegionSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    assets_url = serializers.SerializerMethodField()
    export_url = serializers.SerializerMethodField()
    users = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = (
            'uid',
            'name',
            'url',
            'assets_url',
            'export_url',
            'countries',
            'permissions',
            'users',
        )

    def get_assets_url(self, obj) -> str:
        return reverse(
            'region-assets',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_export_url(self, obj) -> str:
        return reverse(
            'region-export',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_users(self, obj) -> List[str]:
        return obj.users.all().values_list('username', flat=True)

    def get_url(self, obj) -> str:
        return reverse(
            'region-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
