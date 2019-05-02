# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers

from kpi.models import Collection


class AncestorCollectionsSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')

    class Meta:
        model = Collection
        fields = ('name', 'uid', 'url')
