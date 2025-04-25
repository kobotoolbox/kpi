# coding: utf-8
from django.shortcuts import get_object_or_404

from kpi.models import Asset


class AssetNestedObjectViewsetMixin:

    @property
    def asset(self):
        # FIXME
        #   Remove the return None and find why we cannot generate the api with
        #   the below code
        # return None
        if hasattr(self, 'swagger_fake_view'):
            return None

        if not hasattr(self, '_asset'):
            asset = get_object_or_404(
                Asset.objects.defer('content'), uid=self.asset_uid
            )
            setattr(self, '_asset', asset)
        return self._asset

    @property
    def asset_uid(self):
        if not hasattr(self, '_asset_uid'):
            asset_uid = self.get_parents_query_dict().get('asset')
            setattr(self, '_asset_uid', asset_uid)
        return self._asset_uid
