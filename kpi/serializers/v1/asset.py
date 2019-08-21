# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from kpi.serializers.v2.asset import AssetSerializer as AssetSerializerV2

from .object_permission import ObjectPermissionNestedSerializer


class AssetSerializer(AssetSerializerV2):

    permissions = ObjectPermissionNestedSerializer(many=True, read_only=True)


class AssetListSerializer(AssetSerializer):
    pass


class AssetUrlListSerializer(AssetSerializer):
    pass
