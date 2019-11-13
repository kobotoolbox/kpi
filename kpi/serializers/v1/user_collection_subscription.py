# coding: utf-8
from rest_framework import serializers

from kpi.constants import PERM_VIEW_COLLECTION
from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models import Collection
from kpi.models import UserCollectionSubscription
from kpi.models.object_permission import get_anonymous_user, get_objects_for_user


class UserCollectionSubscriptionSerializer(serializers.ModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='usercollectionsubscription-detail'
    )
    collection = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        view_name='collection-detail',
        queryset=Collection.objects.none() # will be set in __init__()
    )
    uid = serializers.ReadOnlyField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['collection'].queryset = get_objects_for_user(
            get_anonymous_user(),
            PERM_VIEW_COLLECTION,
            Collection.objects.filter(discoverable_when_public=True)
        )

    class Meta:
        model = UserCollectionSubscription
        lookup_field = 'uid'
        fields = ('url', 'collection', 'uid')
