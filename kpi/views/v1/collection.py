# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from kpi.serializers import CollectionSerializer, CollectionListSerializer
from kpi.views.v2.collection import CollectionViewSet as CollectionViewSetV2


class CollectionViewSet(CollectionViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/collections/`**
    """

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer
