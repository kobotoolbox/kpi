# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers

from kpi.models import Collection
from kpi.fields.versioned_hyperlinked_identity import VersionedHyperlinkedIdentityField


class AncestorCollectionsSerializer(serializers.HyperlinkedModelSerializer):
    url = VersionedHyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')

    class Meta:
        model = Collection
        fields = ('name', 'uid', 'url')
