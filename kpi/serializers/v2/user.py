# coding: utf-8
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kpi.fields import PaginatedApiField
from .asset import AssetUrlListSerializer


class UserSerializer(serializers.HyperlinkedModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='username', view_name='user-detail')
    assets = PaginatedApiField(
        serializer_class=AssetUrlListSerializer
    )

    class Meta:
        model = User
        fields = ('url',
                  'username',
                  'assets',
                  'owned_collections',
                  )
        extra_kwargs = {
            'owned_collections': {
                'lookup_field': 'uid',
            },
        }
