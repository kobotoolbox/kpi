from django.forms import widgets
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy
from kpi.models import SurveyAsset
from kpi.models import Collection

from django.contrib.auth.models import User
import json

class Paginated(PaginationSerializer):
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('api-root', request=request)

import json
from rest_framework import serializers

class WritableJSONField(serializers.Field):
    """ Serializer for JSONField -- required to make field writable"""
    def to_internal_value(self, data):
        return data
    def to_representation(self, value):
        return value

class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    ownerName = serializers.ReadOnlyField(source='owner.username')
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', read_only=True)
    tableView = serializers.HyperlinkedIdentityField(view_name='surveyasset-tableview')
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    assetType = serializers.ReadOnlyField(read_only=True, source='asset_type')
    content = WritableJSONField()
    collectionName = serializers.ReadOnlyField(read_only=True, source='collection.name')
    collection = serializers.PrimaryKeyRelatedField(queryset=Collection.objects.all(), allow_null=True, required=False)
    collectionLink = serializers.HyperlinkedRelatedField(source='collection', view_name='collection-detail', read_only=True)
    additional_sheets = WritableJSONField()
    uid = serializers.HyperlinkedIdentityField(
        view_name='surveyasset-detail',
        lookup_field='uid',
    )

    class Meta:
        model = SurveyAsset
        fields = ('url', 'parent', 'tableView', 'owner', 'ownerName', 'collection',
                    'settings', 'assetType', 'collectionLink', 'additional_sheets',
                    'collectionName', 'uid', 'name', 'content')
    def _content(self, obj):
        return json.dumps(obj.content)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('surveyasset-list', request=request)

class UserSerializer(serializers.HyperlinkedModelSerializer):
    survey_assets = serializers.HyperlinkedRelatedField(many=True,
                 view_name='surveyasset-detail', read_only=True)
    class Meta:
        model = User
        fields = ('url', 'username', 'survey_assets', 'collections')

class CollectionSerializer(serializers.HyperlinkedModelSerializer):
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', read_only=True)

    class Meta:
        model = Collection
        fields = ('name', 'url', 'survey_assets', 'collections', 'uid', 'owner')
