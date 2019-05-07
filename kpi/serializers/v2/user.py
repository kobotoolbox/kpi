# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.contrib.auth.models import User
from rest_framework import serializers

from kpi.fields import PaginatedApiField
from kpi.fields.versioned_hyperlinked_identity import VersionedHyperlinkedIdentityField
from .asset import AssetUrlListSerializer


class UserSerializer(serializers.HyperlinkedModelSerializer):

    url = VersionedHyperlinkedIdentityField(
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
