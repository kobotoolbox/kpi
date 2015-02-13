from django.forms import widgets
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy
from kpi.models import SurveyAsset, LANGUAGE_CHOICES, STYLE_CHOICES
from kpi.models import Collection

from django.contrib.auth.models import User


class Paginated(PaginationSerializer):
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        request = self.context.get('request', None)
        return reverse_lazy('api-root', request=request)


class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    ownerName = serializers.ReadOnlyField(source='owner.username')
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', read_only=True)
    highlight = serializers.HyperlinkedIdentityField(view_name='surveyasset-highlight')
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    collectionId = serializers.ReadOnlyField(read_only=True, source='collection_id')
    collectionName = serializers.ReadOnlyField(read_only=True, source='collection.name')
    collectionLink = serializers.HyperlinkedRelatedField(view_name='collection-detail', read_only=True, source='collection')

    class Meta:
        model = SurveyAsset
        fields = ('url', 'parent', 'highlight', 'owner', 'ownerName', 'collectionLink',
                    'collectionName', 'uuid',
                  'title', 'code', 'linenos', 'language', 'style', 'collectionId')

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
        fields = ('name', 'url', 'survey_assets', 'collections', 'uuid', 'owner')
