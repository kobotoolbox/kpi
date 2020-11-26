# coding: utf-8
# importing module instead of the class, avoid running the tests twice
from kpi.tests.api.v2 import test_api_collections


class CollectionsTests(test_api_collections.CollectionsTests):

    URL_NAMESPACE = None

    def test_collection_statuses_and_access_types(self):
        # Only need for v2
        pass
