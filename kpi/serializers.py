from django.forms import widgets
from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from django.utils.six.moves.urllib import parse as urlparse
from django.core.urlresolvers import get_script_prefix
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework.pagination import PaginationSerializer
from rest_framework.reverse import reverse_lazy, reverse
from .models import SurveyAsset
from .models import Collection
from .models import ObjectPermission
from .models.object_permission import get_anonymous_user
from taggit.models import Tag
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

class SurveyAssetContentField(serializers.Field):
    '''
    not sure if this custom field will survive.
    '''
    def to_internal_value(self, data):
        return json.loads(data)
    def to_representation(self, value):
        return {'redirect': 'content_link'}


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
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        return [reverse('surveyasset-detail', args=(sa.uid,), request=request) \
                for sa in SurveyAsset.objects.filter(tags=obj, owner=user).all()]

    def _get_collections(self, obj):
        request = self.context.get('request', None)
        user = request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        return [reverse('collection-detail', args=(coll.uid,), request=request) \
                for coll in Collection.objects.filter(tags=obj, owner=user).all()]

    def _get_tag_url(self, obj):
        request = self.context.get('request', None)
        return reverse('tag-detail', args=(obj.name,), request=request)

class TagListSerializer(TagSerializer):
    class Meta:
        model = Tag
        fields = ('name', 'url', )

class GenericHyperlinkedRelatedField(serializers.HyperlinkedRelatedField):
    def __init__(self, **kwargs):
        # These arguments are required by ancestors but meaningless in our
        # situation. We will override them dynamically.
        kwargs['view_name'] = '*'
        kwargs['queryset'] = ObjectPermission.objects.none()
        return super(GenericHyperlinkedRelatedField, self).__init__(**kwargs)

    def to_representation(self, value):
        self.view_name = '{}-detail'.format(
            ContentType.objects.get_for_model(value).model)
        result = super(GenericHyperlinkedRelatedField, self).to_representation(
            value)
        self.view_name = '*'
        return result

    def to_internal_value(self, data):
        ''' The vast majority of this method has been copied and pasted from
        HyperlinkedRelatedField.to_internal_value(). Modifications exist
        to allow any type of object. '''
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        if http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse.urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        try:
            match = self.resolve(data)
        except Resolver404:
            self.fail('no_match')

        ''' Begin modifications '''
        # We're a generic relation; we don't discriminate
        #if match.view_name != self.view_name:
        #    self.fail('incorrect_match')

        # Dynamically modify the queryset
        self.queryset = match.func.cls.queryset
        ''' End modifications '''

        try:
            return self.get_object(match.view_name, match.args, match.kwargs)
        except (ObjectDoesNotExist, TypeError, ValueError):
            self.fail('does_not_exist')

class ObjectPermissionSerializer(serializers.ModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='objectpermission-detail'
    )
    user = serializers.HyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        queryset=User.objects.all(),
    )
    permission = serializers.SlugRelatedField(
        slug_field='codename',
        queryset=Permission.objects.all()
    )
    content_object = GenericHyperlinkedRelatedField(
        lookup_field='uid',
        style={'base_template': 'input.html'} # Render as a simple text box
    )
    inherited = serializers.ReadOnlyField()

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
            'content_object',
            'deny',
            'inherited',
        )

    def create(self, validated_data):
        validated_data['inherited'] = False
        return super(ObjectPermissionSerializer, self).create(validated_data)

class SurveyAssetSerializer(serializers.HyperlinkedModelSerializer):
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', lookup_field='username',
                                                read_only=True,)
    owner__username = serializers.ReadOnlyField(source='owner.username')
    parent = serializers.SerializerMethodField('get_parent_url', read_only=True)
    url = serializers.HyperlinkedIdentityField(lookup_field='uid', view_name='surveyasset-detail')
    asset_type = serializers.ReadOnlyField()
    settings = WritableJSONField(required=False)
    content_link = serializers.SerializerMethodField()
    xls_link = serializers.SerializerMethodField()
    koboform_link = serializers.SerializerMethodField()
    xform_link = serializers.SerializerMethodField()
    content = SurveyAssetContentField(style={'base_template': 'muted_readonly_content_field.html'})
    tags = serializers.SerializerMethodField('_get_tag_names')
    version_count = serializers.SerializerMethodField('_version_count')
    parent = serializers.HyperlinkedRelatedField(lookup_field='uid', queryset=Collection.objects.all(),
                                                view_name='collection-detail', required=False)
    permissions = ObjectPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyAsset
        lookup_field = 'uid'
        fields = ('url',
                    'parent',
                    'owner',
                    'owner__username',
                    'parent',
                    'settings',
                    'asset_type',
                    'date_created',
                    'date_modified',
                    'tags',
                    'version_count',
                    'content_link',
                    'koboform_link',
                    'content',
                    'xform_link',
                    'uid',
                    'xls_link',
                    'name', 'tags',
                    'permissions',)
        extra_kwargs = {
            'parent': {
                'lookup_field': 'uid',
            },
        }

    def get_fields(self, *args, **kwargs):
        fields = super(SurveyAssetSerializer, self).get_fields(*args, **kwargs)
        user = self.context['request'].user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
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
    def get_koboform_link(self, obj):
        return reverse('surveyasset-koboform', args=(obj.uid,), request=self.context.get('request', None))

    def _content(self, obj):
        return json.dumps(obj.content)

    def _get_tag_names(self, obj):
        return obj.tags.names()

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('surveyasset-table-view', args=(obj.uid,), request=request)


class SurveyAssetListSerializer(SurveyAssetSerializer):
    class Meta(SurveyAssetSerializer.Meta):
        fields = ('url', 
                  'date_modified',
                  'date_created',
                  'owner',
                  'parent',
                  'uid',
                  'name',
                  'asset_type',
                  'permissions',
                  'tags',)


class UserSerializer(serializers.HyperlinkedModelSerializer):
    survey_assets = serializers.HyperlinkedRelatedField(many=True,
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
    url = serializers.HyperlinkedIdentityField(lookup_field='uid', view_name='collection-detail')
    owner = serializers.HyperlinkedRelatedField(view_name='user-detail', \
                lookup_field='username', read_only=True)
    survey_assets = serializers.HyperlinkedRelatedField(many=True, lookup_field='uid',
                 view_name='surveyasset-detail', read_only=True)
    parent = serializers.HyperlinkedRelatedField(lookup_field='uid', required=False,
                 view_name='collection-detail', queryset=Collection.objects.all())
    children = serializers.HyperlinkedRelatedField(many=True, lookup_field='uid',
                 view_name='collection-detail', read_only=True)
    tags = serializers.SerializerMethodField('_get_tag_names')
    permissions = ObjectPermissionSerializer(many=True, read_only=True)

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
                    'permissions',
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
