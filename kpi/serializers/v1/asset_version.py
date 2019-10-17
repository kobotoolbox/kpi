# -*- coding: utf-8 -*-
from __future__ import absolute_import

from kpi.serializers.v2.asset_version import \
    AssetVersionListSerializer as AssetVersionListSerializerV2, \
    AssetVersionSerializer as AssetVersionSerializerV2


class AssetVersionListSerializer(AssetVersionListSerializerV2):
    pass


class AssetVersionSerializer(AssetVersionSerializerV2):
    pass
