# -*- coding: utf-8 -*-
from __future__ import absolute_import

from kpi.fields import PaginatedApiField
from kpi.serializers.v2.user import UserSerializer as UserSerializerV2
from .asset import AssetUrlListSerializer


class UserSerializer(UserSerializerV2):
    assets = PaginatedApiField(
        serializer_class=AssetUrlListSerializer
    )
