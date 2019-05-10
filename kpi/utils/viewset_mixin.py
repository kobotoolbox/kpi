# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from django.shortcuts import get_object_or_404

from kpi.models import Asset


class AssetNestedObjectViewsetMixin:

    @property
    def asset(self):
        if not hasattr(self, '_asset'):
            asset_uid = self.get_parents_query_dict().get("asset")
            asset = get_object_or_404(Asset, uid=asset_uid)
            setattr(self, '_asset', asset)
        return self._asset
