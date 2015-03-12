from django.forms import widgets
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy, reverse
from kpi.models import SurveyAsset
from kpi.models import Collection
import urllib
import json


class Paginated(PaginationSerializer):
    """ Adds 'root' to the wrapping response object. """
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class WritableJSONField(serializers.Field):
    """ Serializer for JSONField -- required to make field writable"""
    def to_internal_value(self, data):
        return json.loads(data)
    def to_representation(self, value):
        return value

class TaggedHyperlinkedRelatedField(serializers.HyperlinkedRelatedField):
    def get_url(self, *args, **kwargs):
        url = super(TaggedHyperlinkedRelatedField, self).get_url(*args, **kwargs)
        obj = args[0]
        if obj.name == '':
            return url
        return '%s#%s' % (url, urllib.quote_plus(obj.name))

class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', lookup_field='username', \
                                                read_only=True)
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    assetType = serializers.ReadOnlyField(read_only=True, source='asset_type')
    settings = WritableJSONField(required=False)
    collection = TaggedHyperlinkedRelatedField(lookup_field='uid', queryset=Collection.objects.all(),
                                                view_name='collection-detail', required=False)
    content = WritableJSONField(write_only=True)
    ss_json = serializers.SerializerMethodField('_to_ss_json', read_only=True)
    tags = serializers.SerializerMethodField('get_tag_names')

    class Meta:
        model = SurveyAsset
        lookup_field = 'uid'
        fields = ('url', 'parent', 'owner', 'collection',
                    'settings', 'assetType', 'ss_json',
                    'name', 'content', 'tags', )
        extra_kwargs = {
            'collection': {
                'lookup_field': 'uid',
            },
        }

    def _to_ss_json(self, obj):
        return obj._to_ss_structure()

    def _content(self, obj):
        return json.dumps(obj.content)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('surveyasset-list', request=request)

    def get_tag_names(self, obj):
        return obj.tags.names()

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('surveyasset-table-view', args=(obj.uid,), request=request)

    # def _get_collection_route(self, obj):
    #     '''
    #     it would be nice to get these urls routing to the uid, instead of the numeric id
    #     '''
    #     request = self.context.get('request', None)
    #     return reverse('collection-detail', args=(obj.collection.uid,), request=request)

class SurveyAssetListSerializer(SurveyAssetSerializer):
    class Meta(SurveyAssetSerializer.Meta):
        fields = ('url', 'owner', 'collection',
                    'assetType', 'name', 'tags',)


class UserSerializer(serializers.HyperlinkedModelSerializer):
    survey_assets = TaggedHyperlinkedRelatedField(many=True,
                 view_name='surveyasset-detail', read_only=True)

    class Meta:
        model = User
        fields = ('url', 'username', 'survey_assets', 'collections')
        lookup_field = 'username'
        extra_kwargs = {
            'collections': {
                'lookup_field': 'uid',
            },
        }

class UserListSerializer(UserSerializer):
    survey_assets_count = serializers.SerializerMethodField('_survey_assets_count')
    collections_count = serializers.SerializerMethodField('_collections_count')

    def _collections_count(self, obj):
        return obj.collections.count()
    def _survey_assets_count(self, obj):
        return obj.survey_assets.count()

    class Meta(UserSerializer.Meta):
        fields = ('url', 'username', 'survey_assets_count', 'collections_count',)


class CollectionSerializer(serializers.HyperlinkedModelSerializer):
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', \
                lookup_field='username', read_only=True)
    survey_assets = TaggedHyperlinkedRelatedField(many=True, lookup_field='uid',
                 view_name='surveyasset-detail', read_only=True)
    tags = serializers.SerializerMethodField('get_tag_names')

    class Meta:
        model = Collection
        fields = ('name', 'url', 'survey_assets', 'owner', 'tags',)
        lookup_field = 'uid'
        extra_kwargs = {
            'survey_assets': {
                'lookup_field': 'uid',
            },
        }

    def get_tag_names(self, obj):
        return obj.tags.names()

class CollectionListSerializer(CollectionSerializer):
    class Meta(CollectionSerializer.Meta):
        fields = ('name', 'url', 'owner', 'tags',)