from zoneinfo import ZoneInfo

from django.conf import settings
from django_request_cache import cache_for_request
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_COLLECTION, PERM_DISCOVER_ASSET
from kpi.models.asset import Asset, UserAssetSubscription
from kpi.models.object_permission import ObjectPermission


class UserSerializer(serializers.HyperlinkedModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='username', view_name='user-kpi-detail')
    date_joined = serializers.SerializerMethodField()
    public_collection_subscribers_count = serializers.SerializerMethodField()
    public_collections_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('url',
                  'username',
                  'date_joined',
                  'public_collection_subscribers_count',
                  'public_collections_count',
                  )

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(ZoneInfo('UTC')).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_public_collection_subscribers_count(self, user):
        public_collection_ids = self.__get_public_collection_ids(user.pk)
        return UserAssetSubscription.objects.filter(
            asset_id__in=public_collection_ids).exclude(user_id=user.pk).count()

    def get_public_collections_count(self, user):
        public_collection_ids = self.__get_public_collection_ids(user.pk)
        return len(public_collection_ids)

    @staticmethod
    @cache_for_request
    def __get_public_collection_ids(user_id):
        collection_ids = Asset.objects.filter(
            owner_id=user_id, asset_type=ASSET_TYPE_COLLECTION). \
            values_list('id', flat=True)

        # A collection is considered as public when it's shared
        # with `AnonymousUser`.
        return ObjectPermission.objects.filter(
            asset_id__in=collection_ids,
            user_id=settings.ANONYMOUS_USER_ID,
            permission__codename=PERM_DISCOVER_ASSET).values_list('asset_id',
                                                                  flat=True)


class UserListSerializer(UserSerializer):
    metadata = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = (
            'id',
            'username',
            'is_superuser',
            'date_joined',
            'last_login',
            'is_active',
            'email',
            'asset_count',
            'metadata',
        )

    def get_asset_count(self, user):
        return user.assets.count()

    def get_metadata(self, user):
        if not hasattr(user, 'extra_details'):
            return {}
        return user.extra_details.data
