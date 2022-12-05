# coding: utf-8
from __future__ import annotations

from rest_framework import serializers
from rest_framework.reverse import reverse

from .models.region import Region


class RegionSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    users = serializers.SerializerMethodField()
    assigned_users = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = (
            'uid',
            'name',
            'url',
            'assets',
            'users',
            'countries',
            'permissions',
            'assigned_users',
        )

    def get_assets(self, obj) -> str:
        return reverse(
            'region-assets',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_assigned_users(self, obj) -> List[str]:
        return obj.users.all().values_list('username', flat=True)

    def get_users(self, obj) -> str:
        return reverse(
            'region-users',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_url(self, obj) -> str:
        return reverse(
            'region-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
