# -*- coding: utf-8 -*-
from __future__ import absolute_import

# importing module instead of the class, avoid running the tests twice
from kpi.tests.api.v2 import test_api_asset_snapshots


class TestAssetSnapshotList(test_api_asset_snapshots.TestAssetSnapshotList):

    URL_NAMESPACE = None

