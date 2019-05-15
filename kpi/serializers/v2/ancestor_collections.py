# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kpi.models import Collection


class AncestorCollectionsSerializer(serializers.HyperlinkedModelSerializer):
    url = HyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')

    class Meta:
        model = Collection
        fields = ('name', 'uid', 'url')
