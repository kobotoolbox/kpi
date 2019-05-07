# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from kpi.serializers import AssetSnapshotSerializer
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet as AssetSnapshotViewSetV2


class AssetSnapshotViewSet(AssetSnapshotViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/asset_snapshots/`**
    """
    URL_NAMESPACE = None

    serializer_class = AssetSnapshotSerializer
