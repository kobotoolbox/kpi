# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from .models.region import Region


class RegionServiceSerializer(serializers.ModelSerializer):

    class Meta:
        fields = (
            'uid',
            'name',
            'countries',
            'permissions',
        )


class RegionSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    view_url = serializers.SerializerMethodField()
    export_url = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = (
            'uid',
            'name',
            'url',
            'view_url',
            'export_url',
            'countries',
            'permissions',
        )

    def get_url(self, obj) -> str:
        return reverse(
            'region-detail',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_view_url(self, obj) -> str:
        return reverse(
            'region-view',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_export_url(self, obj) -> str:
        return reverse(
            'region-export',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )
