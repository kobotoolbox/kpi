# coding: utf-8
import pytz

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django_request_cache import cache_for_request
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kpi.constants import ASSET_TYPE_COLLECTION, PERM_DISCOVER_ASSET
from kpi.fields import PaginatedApiField
from kpi.models.asset import Asset, UserAssetSubscription
from kpi.models.object_permission import ObjectPermission
from .asset import AssetUrlListSerializer


class UserSerializer(serializers.HyperlinkedModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='username', view_name='user-detail')
    assets = PaginatedApiField(
        serializer_class=AssetUrlListSerializer
    )
    date_joined = serializers.SerializerMethodField()
    public_collection_subscribers_count = serializers.SerializerMethodField()
    public_collections_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('url',
                  'username',
                  'assets',
                  'date_joined',
                  'public_collection_subscribers_count',
                  'public_collections_count',
                  )

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(pytz.UTC).strftime(
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
