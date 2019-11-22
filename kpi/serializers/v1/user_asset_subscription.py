# coding: utf-8
from rest_framework import serializers

from kpi.constants import PERM_DISCOVER_ASSET, PERM_VIEW_ASSET
from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models import Asset
from kpi.models import UserAssetSubscription
from kpi.models.object_permission import get_anonymous_user, get_objects_for_user


class UserAssetSubscriptionSerializer(serializers.ModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='userassetsubscription-detail'
    )
    asset = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        view_name='asset-detail',
        queryset=Asset.objects.none() # will be set in __init__()
    )
    uid = serializers.ReadOnlyField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['asset'].queryset = get_objects_for_user(
            get_anonymous_user(),
            [PERM_VIEW_ASSET, PERM_DISCOVER_ASSET],
            Asset
        )

    class Meta:
        model = UserAssetSubscription
        lookup_field = 'uid'
        fields = ('url', 'asset', 'uid')
