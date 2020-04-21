# coding: utf-8
from django.shortcuts import get_object_or_404

from kpi.models import Asset, Collection


class AssetNestedObjectViewsetMixin:

    @property
    def asset(self):
        if not hasattr(self, '_asset'):
            asset = get_object_or_404(Asset, uid=self.asset_uid)
            setattr(self, '_asset', asset)
        return self._asset

    @property
    def asset_uid(self):
        if not hasattr(self, '_asset_uid'):
            asset_uid = self.get_parents_query_dict().get('asset')
            setattr(self, '_asset_uid', asset_uid)
        return self._asset_uid


class CollectionNestedObjectViewsetMixin:

    @property
    def collection(self):
        if not hasattr(self, '_collection'):
            collection = get_object_or_404(Collection, uid=self.collection_uid)
            setattr(self, '_collection', collection)
        return self._collection

    @property
    def collection_uid(self):
        if not hasattr(self, '_collection_uid'):
            collection_uid = self.get_parents_query_dict().get('collection')
            setattr(self, '_collection_uid', collection_uid)
        return self._collection_uid
