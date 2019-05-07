# -*- coding: utf-8 -*-
from __future__ import absolute_import

from kpi.serializers.v2.asset import AssetSerializer as AssetSerializerV2, \
    AssetListSerializer as AssetListSerializerV2, \
    AssetUrlListSerializer as AssetUrlListSerializerV2
from .object_permission import ObjectPermissionNestedSerializer


class AssetSerializer(AssetSerializerV2):

    permissions = ObjectPermissionNestedSerializer(many=True, read_only=True)


class AssetListSerializer(AssetListSerializerV2):
    pass


class AssetUrlListSerializer(AssetUrlListSerializerV2):
    pass
