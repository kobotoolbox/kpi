# coding: utf-8
from kpi.fields import PaginatedApiField
from kpi.serializers.v2.user import UserSerializer as UserSerializerV2
from .asset import AssetUrlListSerializer


class UserSerializer(UserSerializerV2):
    assets = PaginatedApiField(
        serializer_class=AssetUrlListSerializer
    )
    date_joined = None
    public_collection_subscribers_count = None
    public_collections_count = None

    class Meta(UserSerializerV2.Meta):
        fields = ('url',
                  'username',
                  'assets',
                  )
