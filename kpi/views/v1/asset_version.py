# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from kpi.serializers import AssetVersionListSerializer, AssetVersionSerializer
from kpi.views.v2.asset_version import \
    AssetVersionViewSet as AssetVersionViewSetV2


class AssetVersionViewSet(AssetVersionViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/{uid}/versions`**
    """

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetVersionListSerializer
        else:
            return AssetVersionSerializer
