from django.forms import widgets
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy, reverse
from kpi.models import SurveyAsset
from kpi.models import Collection
import reversion
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
        # what if ?n=~form_title at the end of the url redirected to (or suggested a list)
        # approx matches in case the asset of the form builder has been deleted or 404s?
        return u'%s?n=~%s' % (url, urllib.quote_plus(obj.name.encode('utf-8')))

class TaggedHyperlinkedIdentityField(serializers.HyperlinkedIdentityField):
    def get_url(self, *args, **kwargs):
        url = super(TaggedHyperlinkedIdentityField, self).get_url(*args, **kwargs)
        obj = args[0]
        if obj.name == '':
            return url
        return u'%s?n=~%s' % (url, urllib.quote_plus(obj.name.encode('utf-8')))

class SurveyAssetContentField(serializers.Field):
    '''
    not sure if this custom field will survive.
    '''
    def to_internal_value(self, data):
        return json.loads(data)
    def to_representation(self, value):
        return {'redirect': 'content_link'}

from taggit.models import Tag

class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField('_get_tag_url', read_only=True)
    survey_assets = serializers.SerializerMethodField('_get_survey_assets', read_only=True)
    collections = serializers.SerializerMethodField('_get_collections', read_only=True)
    parent = serializers.SerializerMethodField('_get_parent_url', read_only=True)

    class Meta:
        model = Tag
        fields = ('name', 'url', 'survey_assets', 'collections', 'parent')

    def _get_parent_url(self, obj):
        return reverse('tag-list', request=self.context.get('request', None))

    def _get_survey_assets(self, obj):
        request = self.context.get('request', None)
        user = request.user
        return [reverse('surveyasset-detail', args=(sa.uid,), request=request) \
                for sa in SurveyAsset.objects.filter(tags=obj, owner=user).all()]

    def _get_collections(self, obj):
        request = self.context.get('request', None)
        user = request.user
        return [reverse('collection-detail', args=(coll.uid,), request=request) \
                for coll in Collection.objects.filter(tags=obj, owner=user).all()]

    def _get_tag_url(self, obj):
        request = self.context.get('request', None)
        return reverse('tag-detail', args=(obj.name,), request=request)

class TagListSerializer(TagSerializer):
    class Meta:
        model = Tag
        fields = ('name', 'url', )

class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', lookup_field='username',
                                                read_only=True,)
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    url = TaggedHyperlinkedIdentityField(lookup_field='uid', view_name='surveyasset-detail')
    assetType = serializers.ReadOnlyField(read_only=True, source='asset_type')
    settings = WritableJSONField(required=False)#, style={'base_template': 'json_field.html'})
    content_link = serializers.SerializerMethodField()
    xls_link = serializers.SerializerMethodField()
    xform_link = serializers.SerializerMethodField()
    content = SurveyAssetContentField(style={'base_template': 'muted_readonly_content_field.html'})
    tags = serializers.SerializerMethodField('_get_tag_names')
    version_count = serializers.SerializerMethodField('_version_count')
    parent = TaggedHyperlinkedRelatedField(lookup_field='uid', queryset=Collection.objects.all(),
                                                view_name='collection-detail', required=False)

    class Meta:
        model = SurveyAsset
        lookup_field = 'uid'
        fields = ('url', 'parent', 'owner', 'parent',
                    'settings',
                    'assetType',
                    'date_created',
                    'date_modified',
                    'tags',
                    'version_count',
                    'content_link',
                    'content',
                    'xform_link',
                    'xls_link',
                    'name', 'tags', )
        extra_kwargs = {
            'parent': {
                'lookup_field': 'uid',
            },
        }

    def get_fields(self, *args, **kwargs):
        fields = super(SurveyAssetSerializer, self).get_fields(*args, **kwargs)
        user = self.context['request'].user
        fields['parent'].queryset = fields['parent'].queryset.filter(owner=user)
        return fields

    def _version_count(self, obj):
        return reversion.get_for_object(obj).count()

    def get_content_link(self, obj):
        return reverse('surveyasset-content', args=(obj.uid,), request=self.context.get('request', None))
    def get_xls_link(self, obj):
        return reverse('surveyasset-xls', args=(obj.uid,), request=self.context.get('request', None))
    def get_xform_link(self, obj):
        return reverse('surveyasset-xform', args=(obj.uid,), request=self.context.get('request', None))

    def _content(self, obj):
        return json.dumps(obj.content)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('surveyasset-list', request=request)

    def _get_tag_names(self, obj):
        return obj.tags.names()

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('surveyasset-table-view', args=(obj.uid,), request=request)


class SurveyAssetListSerializer(SurveyAssetSerializer):
    class Meta(SurveyAssetSerializer.Meta):
        fields = ('url', 'owner', 'parent',
                    'assetType', 'name', 'tags',)


class UserSerializer(serializers.HyperlinkedModelSerializer):
    survey_assets = TaggedHyperlinkedRelatedField(many=True,
                 view_name='surveyasset-detail', read_only=True)

    class Meta:
        model = User
        fields = ('url', 'username', 'survey_assets', 'owned_collections')
        lookup_field = 'username'
        extra_kwargs = {
            'owned_collections': {
                'lookup_field': 'uid',
            },
        }

class UserListSerializer(UserSerializer):
    survey_assets_count = serializers.SerializerMethodField('_survey_assets_count')
    collections_count = serializers.SerializerMethodField('_collections_count')

    def _collections_count(self, obj):
        return obj.owned_collections.count()
    def _survey_assets_count(self, obj):
        return obj.survey_assets.count()

    class Meta(UserSerializer.Meta):
        fields = ('url', 'username', 'survey_assets_count', 'collections_count',)


class CollectionSerializer(serializers.HyperlinkedModelSerializer):
    url = TaggedHyperlinkedIdentityField(lookup_field='uid', view_name='collection-detail')
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', \
                lookup_field='username', read_only=True)
    survey_assets = TaggedHyperlinkedRelatedField(many=True, lookup_field='uid',
                 view_name='surveyasset-detail', read_only=True)
    parent = TaggedHyperlinkedRelatedField(lookup_field='uid',
                 view_name='collection-detail', read_only=True)
    children = TaggedHyperlinkedRelatedField(many=True, lookup_field='uid',
                 view_name='collection-detail', read_only=True)
    tags = serializers.SerializerMethodField('_get_tag_names')

    class Meta:
        model = Collection
        fields = ('name',
                    'url',
                    'parent',
                    'children',
                    'survey_assets',
                    'owner',
                    'tags',
                    'date_created',
                    'date_modified',
                )
        lookup_field = 'uid'
        extra_kwargs = {
            'survey_assets': {
                'lookup_field': 'uid',
            },
        }

    def _get_tag_names(self, obj):
        return obj.tags.names()

class CollectionListSerializer(CollectionSerializer):
    class Meta(CollectionSerializer.Meta):
        fields = ('name',
                    'url',
                    'parent',
                    'owner',
                    'tags',
                    'date_created',
                    'date_modified',
                )
