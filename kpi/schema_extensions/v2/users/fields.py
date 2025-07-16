from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class AssetCountField(serializers.SerializerMethodField):
    pass


class CollectionCount(serializers.SerializerMethodField):
    pass


class DateJoinedField(serializers.SerializerMethodField):
    pass


class MetadataField(serializers.SerializerMethodField):
    pass


class PublicCollectionSubscriptionField(serializers.SerializerMethodField):
    pass


class UserUrlField(HyperlinkedIdentityField):
    pass
