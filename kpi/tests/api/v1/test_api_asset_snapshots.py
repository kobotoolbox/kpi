import pytest

# importing module instead of the class, avoid running the tests twice
from kpi.tests.api.v2 import test_api_asset_snapshots


class TestAssetSnapshotList(test_api_asset_snapshots.TestAssetSnapshotList):

    URL_NAMESPACE = None

    @pytest.mark.skip(reason='Only usable in v2')
    def test_head_requests_return_empty_responses(self):
        pass
