# coding: utf-8
from rest_framework import serializers

from kpi.fields import PaginatedApiField
from kpi.models import Asset
from kpi.models import Collection
from kpi.models import CollectionChildrenQuerySet
from kpi.serializers.v2 import collection
from .ancestor_collections import AncestorCollectionsSerializer
from .asset import AssetListSerializer
from .object_permission import ObjectPermissionSerializer


class CollectionChildrenSerializer(serializers.Serializer):
    def to_representation(self, value):
        if isinstance(value, Collection):
            serializer = CollectionListSerializer
        elif isinstance(value, Asset):
            serializer = AssetListSerializer
        else:
            raise Exception('Unexpected child type {}'.format(type(value)))
        return serializer(value, context=self.context).data


class CollectionSerializer(collection.CollectionSerializer):

    # ancestors are ordered from farthest to nearest
    ancestors = AncestorCollectionsSerializer(
        many=True, read_only=True, source='get_ancestors_or_none')
    children = PaginatedApiField(
        serializer_class=CollectionChildrenSerializer,
        # "The value `source='*'` has a special meaning, and is used to indicate
        # that the entire object should be passed through to the field"
        # (http://www.django-rest-framework.org/api-guide/fields/#source).
        source='*',
        source_processor=lambda source: CollectionChildrenQuerySet(
            source
        ).optimize_for_list()
    )

    permissions = ObjectPermissionSerializer(many=True, read_only=True)


class CollectionListSerializer(collection.CollectionListSerializer,
                               CollectionSerializer):

    permissions = ObjectPermissionSerializer(many=True, read_only=True)
