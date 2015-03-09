from django.forms import widgets
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy, reverse
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
        return json.loads(data)
    def to_representation(self, value):
        return value

class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    ownerName = serializers.ReadOnlyField(source='owner.username')
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', read_only=True)
    # table_view = serializers.HyperlinkedIdentityField(view_name='surveyasset-table-view', read_only=True)
    # tableView = serializers.SerializerMethodField('_table_url', read_only=True)
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    assetType = serializers.ReadOnlyField(read_only=True, source='asset_type')
    content = WritableJSONField()
    settings = WritableJSONField(required=False)
    collectionName = serializers.ReadOnlyField(read_only=True, source='collection.name')
    collection = serializers.PrimaryKeyRelatedField(queryset=Collection.objects.all(), allow_null=True, required=False)
    collectionLink = serializers.HyperlinkedRelatedField(source='collection', view_name='collection-detail', read_only=True)
    # collectionLink = serializers.SerializerMethodField('_get_collection_route', read_only=True)
    additional_sheets = WritableJSONField(required=False)

    class Meta:
        model = SurveyAsset
        lookup_field = 'uid'
        fields = ('url', 'parent', 'owner', 'ownerName', 'collection',
                    'settings', 'assetType', 'collectionLink', 'additional_sheets',
                    'collectionName', 'uid', 'name', 'content')
    def _content(self, obj):
        return json.dumps(obj.content)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('surveyasset-list', request=request)

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('surveyasset-table-view', args=(obj.uid,), request=request)

    # def _get_collection_route(self, obj):
    #     '''
    #     it would be nice to get these urls routing to the uid, instead of the numeric id
    #     '''
    #     request = self.context.get('request', None)
    #     return reverse('collection-detail', args=(obj.collection.uid,), request=request)

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
        extra_kwargs = {
            'survey_assets': {
                'lookup_field': 'uid',
            }
        }
