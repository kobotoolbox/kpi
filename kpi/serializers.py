import datetime
import json
from collections import OrderedDict

from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import get_script_prefix, resolve, Resolver404
from django.utils.six.moves.urllib import parse as urlparse
from django.conf import settings
from rest_framework import serializers, exceptions
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.reverse import reverse_lazy, reverse
from taggit.models import Tag

from hub.models import SitewideMessage
from .models import Asset
from .models import AssetSnapshot
from .models import Collection
from .models import CollectionChildrenQuerySet
from .models import UserCollectionSubscription
from .models import ImportTask
from .models import ObjectPermission
from .models.object_permission import get_anonymous_user, get_objects_for_user
from .models.asset import ASSET_TYPES
from .models import TagUid
from .models import OneTimeAuthenticationKey
from .forms import USERNAME_REGEX, USERNAME_MAX_LENGTH
from .forms import USERNAME_INVALID_MESSAGE


class Paginated(LimitOffsetPagination):

    """ Adds 'root' to the wrapping response object. """
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class WritableJSONField(serializers.Field):

    """ Serializer for JSONField -- required to make field writable"""

    def __init__(self, **kwargs):
        self.allow_blank= kwargs.pop('allow_blank', False)
        super(WritableJSONField, self).__init__(**kwargs)

    def to_internal_value(self, data):
        if (not data) and (not self.required):
            return None
        else:
            try:
                return json.loads(data)
            except Exception as e:
                raise serializers.ValidationError(
                    u'Unable to parse JSON: {}'.format(e))

    def to_representation(self, value):
        return value


class ReadOnlyJSONField(serializers.ReadOnlyField):
    def to_representation(self, value):
        return value


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
        _ = self.context.get('request', None)
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        # The script prefix must be removed even if the URL is relative.
        # TODO: Figure out why DRF only strips absolute URLs, or file bug
        if True or http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse.urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        try:
            match = resolve(data)
        except Resolver404:
            self.fail('no_match')

        ### Begin modifications ###
        # We're a generic relation; we don't discriminate
        '''
        try:
            expected_viewname = request.versioning_scheme.get_versioned_viewname(
                self.view_name, request
            )
        except AttributeError:
            expected_viewname = self.view_name

        if match.view_name != expected_viewname:
            self.fail('incorrect_match')
        '''

        # Dynamically modify the queryset
        self.queryset = match.func.cls.queryset
        ### End modifications ###

        try:
            return self.get_object(match.view_name, match.args, match.kwargs)
        except (ObjectDoesNotExist, TypeError, ValueError):
            self.fail('does_not_exist')


class RelativePrefixHyperlinkedRelatedField(
        serializers.HyperlinkedRelatedField):
    def to_internal_value(self, data):
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        # The script prefix must be removed even if the URL is relative.
        # TODO: Figure out why DRF only strips absolute URLs, or file bug
        if True or http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse.urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        return super(
            RelativePrefixHyperlinkedRelatedField, self
        ).to_internal_value(data)


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField('_get_tag_url', read_only=True)
    assets = serializers.SerializerMethodField('_get_assets', read_only=True)
    collections = serializers.SerializerMethodField(
        '_get_collections', read_only=True)
    parent = serializers.SerializerMethodField(
        '_get_parent_url', read_only=True)
    uid = serializers.ReadOnlyField(source='taguid.uid')

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'collections', 'parent', 'uid')

    def _get_parent_url(self, obj):
        return reverse('tag-list', request=self.context.get('request', None))

    def _get_assets(self, obj):
        request = self.context.get('request', None)
        user = request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        return [reverse('asset-detail', args=(sa.uid,), request=request)
                for sa in Asset.objects.filter(tags=obj, owner=user).all()]

    def _get_collections(self, obj):
        request = self.context.get('request', None)
        user = request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        return [reverse('collection-detail', args=(coll.uid,), request=request)
                for coll in Collection.objects.filter(tags=obj, owner=user)
                .all()]

    def _get_tag_url(self, obj):
        request = self.context.get('request', None)
        uid = TagUid.objects.get_or_create(tag=obj)[0].uid
        return reverse('tag-detail', args=(uid,), request=request)


class TagListSerializer(TagSerializer):

    class Meta:
        model = Tag
        fields = ('name', 'url', )


class ObjectPermissionSerializer(serializers.ModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='objectpermission-detail'
    )
    user = RelativePrefixHyperlinkedRelatedField(
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
            'uid',
            'kind',
            'url',
            'user',
            'permission',
            'content_object',
            'deny',
            'inherited',
        )
        extra_kwargs = {
            'uid': {
                'read_only': True,
            },
        }

    def create(self, validated_data):
        content_object = validated_data['content_object']
        user = validated_data['user']
        perm = validated_data['permission'].codename
        return content_object.assign_perm(user, perm)


class AncestorCollectionsSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')

    class Meta:
        model = Collection
        fields = ('name', 'uid', 'url')


class AssetSnapshotSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='assetsnapshot-detail')
    uid = serializers.ReadOnlyField()
    xml = serializers.SerializerMethodField()
    enketopreviewlink = serializers.SerializerMethodField()
    details = WritableJSONField(required=False)
    asset = RelativePrefixHyperlinkedRelatedField(
        queryset=Asset.objects.all(), view_name='asset-detail',
        lookup_field='uid',
        required=False,
        allow_null=True,
        style={'base_template': 'input.html'} # Render as a simple text box
    )
    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        read_only=True
    )
    asset_version_id = serializers.ReadOnlyField()
    date_created = serializers.DateTimeField(read_only=True)
    source = WritableJSONField(required=False)

    def get_xml(self, obj):
        ''' There's too much magic in HyperlinkedIdentityField. When format is
        unspecified by the request, HyperlinkedIdentityField.to_representation()
        refuses to append format to the url. We want to *unconditionally*
        include the xml format suffix. '''
        return reverse(
            viewname='assetsnapshot-detail', format='xml',
            kwargs={'uid': obj.uid},
            request=self.context.get('request', None)
        )

    def get_enketopreviewlink(self, obj):
        return reverse(
            viewname='assetsnapshot-preview',
            kwargs={'uid': obj.uid},
            request=self.context.get('request', None)
        )

    def create(self, validated_data):
        ''' Create a snapshot of an asset, either by copying an existing
        asset's content or by accepting the source directly in the request.
        Transform the source into XML that's then exposed to Enketo
        (and the www). '''
        asset = validated_data.get('asset', None)
        source = validated_data.get('source', None)
        # TODO: Move to a validator?
        if asset and source:
            if not self.context['request'].user.has_perm('view_asset', asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            validated_data['source'] = source
            # when source is included, snapshot is not tied to an individual v_id
            validated_data['asset_version_id'] = None
        elif asset:
            # The client provided an existing asset; read source from it
            if not self.context['request'].user.has_perm('view_asset', asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            validated_data['source'] = asset.content
            # Record the asset's version id
            validated_data['asset_version_id'] = asset.version_id
        elif source:
            # The client provided source directly; no need to copy anything
            # For tidiness, pop off unused fields. `None` avoids KeyError
            validated_data.pop('asset', None)
            validated_data.pop('asset_version_id', None)
        else:
            raise serializers.ValidationError('Specify an asset and/or a source')

        # Force owner to be the requesting user
        validated_data['owner'] = self.context['request'].user
        # Create the snapshot
        snapshot = AssetSnapshot.objects.create(**validated_data)
        if not snapshot.xml:
            raise serializers.ValidationError(snapshot.details)
        return snapshot

    class Meta:
        model = AssetSnapshot
        lookup_field = 'uid'
        fields = ('url',
                  'uid',
                  'owner',
                  'date_created',
                  'xml',
                  'enketopreviewlink',
                  'asset',
                  'asset_version_id',
                  'details',
                  'source',
                  )


class AssetSerializer(serializers.HyperlinkedModelSerializer):
    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail', lookup_field='username', read_only=True)
    owner__username = serializers.ReadOnlyField(source='owner.username')
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='asset-detail')
    asset_type = serializers.ChoiceField(choices=ASSET_TYPES)
    settings = WritableJSONField(required=False, allow_blank=True)
    content = WritableJSONField(required=False)
    chart_styles = WritableJSONField(required=False)
    xls_link = serializers.SerializerMethodField()
    summary = serializers.ReadOnlyField()
    koboform_link = serializers.SerializerMethodField()
    xform_link = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    downloads = serializers.SerializerMethodField()
    embeds = serializers.SerializerMethodField()
    parent = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        queryset=Collection.objects.all(),
        view_name='collection-detail',
        required=False,
        allow_null=True
    )
    ancestors = AncestorCollectionsSerializer(
        many=True, read_only=True, source='get_ancestors_or_none')
    permissions = ObjectPermissionSerializer(many=True, read_only=True)
    tag_string = serializers.CharField(required=False, allow_blank=True)
    version_id = serializers.CharField(read_only=True)
    has_deployment = serializers.ReadOnlyField()
    deployed_version_id = serializers.SerializerMethodField()
    deployed_versions = serializers.SerializerMethodField()
    deployment__identifier = serializers.SerializerMethodField()
    deployment__active = serializers.SerializerMethodField()
    deployment__links = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = ('url',
                  'owner',
                  'owner__username',
                  'parent',
                  'ancestors',
                  'settings',
                  'asset_type',
                  'date_created',
                  'summary',
                  'date_modified',
                  'version_id',
                  'version_count',
                  'has_deployment',
                  'deployed_version_id',
                  'deployed_versions',
                  'deployment__identifier',
                  'deployment__links',
                  'deployment__active',
                  'chart_styles',
                  'content',
                  'downloads',
                  'embeds',
                  'koboform_link',
                  'xform_link',
                  'tag_string',
                  'uid',
                  'kind',
                  'xls_link',
                  'name',
                  'permissions',)
        extra_kwargs = {
            'parent': {
                'lookup_field': 'uid',
            },
            'uid': {
                'read_only': True,
            },
        }

    def get_fields(self, *args, **kwargs):
        fields = super(AssetSerializer, self).get_fields(*args, **kwargs)
        user = self.context['request'].user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        if 'parent' in fields:
            # TODO: remove this restriction?
            fields['parent'].queryset = fields['parent'].queryset.filter(
                owner=user)
        # Honor requests to exclude fields
        # TODO: Actually exclude fields from tha database query! DRF grabs
        # all columns, even ones that are never named in `fields`
        excludes = self.context['request'].GET.get('exclude', '')
        for exclude in excludes.split(','):
            exclude = exclude.strip()
            if exclude in fields:
                fields.pop(exclude)
        return fields

    def get_version_count(self, obj):
        return obj.asset_versions.count()

    def get_xls_link(self, obj):
        return reverse('asset-xls', args=(obj.uid,), request=self.context.get('request', None))

    def get_xform_link(self, obj):
        return reverse('asset-xform', args=(obj.uid,), request=self.context.get('request', None))

    def get_embeds(self, obj):
        request = self.context.get('request', None)

        def _reverse_lookup_format(fmt):
            url = reverse('asset-%s' % fmt,
                          args=(obj.uid,),
                          request=request)
            return {'format': fmt,
                    'url': url, }
        base_url = reverse('asset-detail',
                           args=(obj.uid,),
                           request=request)
        return [
            _reverse_lookup_format('xls'),
            _reverse_lookup_format('xform'),
        ]

    def get_downloads(self, obj):
        def _reverse_lookup_format(fmt):
            request = self.context.get('request', None)
            obj_url = reverse('asset-detail', args=(obj.uid,), request=request)
            # The trailing slash must be removed prior to appending the format
            # extension
            url = '%s.%s' % (obj_url.rstrip('/'), fmt)

            return {'format': fmt,
                    'url': url, }
        return [
            _reverse_lookup_format('xls'),
            _reverse_lookup_format('xml'),
        ]

    def get_koboform_link(self, obj):
        return reverse('asset-koboform', args=(obj.uid,), request=self.context
                       .get('request', None))

    def get_deployed_version_id(self, obj):
        if obj.asset_versions.filter(deployed=True).exists():
            if isinstance(obj.deployment.version, int):
                # this can be removed once the 'replace_deployment_ids'
                # migration has been run
                v_id = obj.deployment.version
                try:
                    return obj.asset_versions.get(_reversion_version_id=v_id).uid
                except ObjectDoesNotExist, e:
                    return obj.asset_versions.filter(deployed=True).first().uid
            else:
                return obj.deployment.version

    def get_deployed_versions(self, asset):
        deployed_versioned_assets = asset.asset_versions.filter(deployed=True)
        return AssetVersionListSerializer(
            deployed_versioned_assets,
            many=True,
            context=self.context
        ).data

    def get_deployment__identifier(self, obj):
        if obj.has_deployment:
            return obj.deployment.identifier

    def get_deployment__active(self, obj):
        return obj.has_deployment and obj.deployment.active

    def get_deployment__links(self, obj):
        if obj.has_deployment and obj.deployment.active:
            return obj.deployment.get_enketo_survey_links()
        else:
            return {}

    def _content(self, obj):
        return json.dumps(obj.content)

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('asset-table-view', args=(obj.uid,), request=request)


class DeploymentSerializer(serializers.Serializer):
    backend = serializers.CharField(required=False)
    identifier = serializers.CharField(read_only=True)
    active = serializers.BooleanField(required=False)
    version = serializers.CharField(required=False)

    def create(self, validated_data):
        asset = self.context['asset']
        # Stop if the requester attempts to deploy any version of the asset
        # except the current one
        if 'version' in validated_data and \
                validated_data['version'] != str(asset.version_id):
            raise NotImplementedError(
                'Only the current version can be deployed')
        # if no backend is provided, use the installation's default backend
        backend_id = validated_data.get('backend',
                                        settings.DEFAULT_DEPLOYMENT_BACKEND)

        asset.connect_deployment(
            backend=backend_id,
            active=validated_data.get('active', False),
        )
        return asset.deployment

    def update(self, instance, validated_data):
        asset = self.context['asset']
        deployment = self.context['asset'].deployment
        if 'backend' in validated_data and \
                validated_data['backend'] != deployment.backend:
            raise exceptions.ValidationError(
                {'backend': 'This field cannot be modified after the initial '
                            'deployment.'})
        # Is this a request to replace the content of the existing, deployed
        # form?
        if 'version' in validated_data:
            # For now, don't check that
            #   validated_data['version'] != str(deployment.version)
            # Instead, send the update to KC even if the content is unchanged
            if validated_data['version'] != str(asset.version_id):
                # We still can't deploy any version other than the current one
                raise NotImplementedError(
                    'Only the current version can be deployed')
            # Overwrite the contents of the form
            deployment.redeploy(active=validated_data['active'])
        else:
            # A regular PATCH request can update only the `active` field
            if 'active' in validated_data:
                deployment.set_active(validated_data['active'])
        return deployment


class ImportTaskSerializer(serializers.HyperlinkedModelSerializer):
    messages = ReadOnlyJSONField(required=False)

    class Meta:
        model = ImportTask
        fields = (
            'status',
            'uid',
            'messages',
            'date_created',
        )
        extra_kwargs = {
            'uid': {
                'read_only': True,
            },
        }

class ImportTaskListSerializer(ImportTaskSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='importtask-detail'
    )
    messages = ReadOnlyJSONField(required=False)

    class Meta(ImportTaskSerializer.Meta):
        fields = (
            'url',
            'status',
            'messages',
            'uid',
            'date_created',
        )


class AssetListSerializer(AssetSerializer):
    class Meta(AssetSerializer.Meta):
        fields = ('url',
                  'date_modified',
                  'date_created',
                  'owner',
                  'summary',
                  'owner__username',
                  'parent',
                  'uid',
                  'tag_string',
                  'settings',
                  'kind',
                  'name',
                  'asset_type',
                  'version_id',
                  'has_deployment',
                  'deployed_version_id',
                  'deployment__identifier',
                  'deployment__active',
                  'permissions',
                  )


class AssetVersionListSerializer(AssetSerializer):
    date_deployed = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()

    def get_date_deployed(self, obj):
        return obj.date_modified

    def get_version_id(self, obj):
        return obj.uid

    class Meta(AssetSerializer.Meta):
        fields = ('version_id', 'date_deployed')


class AssetUrlListSerializer(AssetSerializer):
    class Meta(AssetSerializer.Meta):
        fields = ('url',)


class UserSerializer(serializers.HyperlinkedModelSerializer):
    assets = serializers.SerializerMethodField()
    def get_assets(self, obj):
        paginator = LimitOffsetPagination()
        paginator.default_limit = 10
        page = paginator.paginate_queryset(
            queryset=obj.assets.all(),
            request=self.context.get('request', None)
        )
        serializer = AssetUrlListSerializer(
            page, many=True, read_only=True, context=self.context)
        return OrderedDict([
            ('count', paginator.count),
            ('next', paginator.get_next_link()),
            ('previous', paginator.get_previous_link()),
            ('results', serializer.data)
        ])

    class Meta:
        model = User
        fields = ('url',
                  'username',
                  'assets',
                  'owned_collections',
                  )
        extra_kwargs = {
            'url' : {
                'lookup_field': 'username',
            },
            'owned_collections': {
                'lookup_field': 'uid',
            },
        }


class CreateUserSerializer(serializers.ModelSerializer):
    username = serializers.RegexField(
        regex=USERNAME_REGEX,
        max_length=USERNAME_MAX_LENGTH,
        error_messages={'invalid': USERNAME_INVALID_MESSAGE}
    )
    email = serializers.EmailField()
    class Meta:
        model = User
        fields = (
            'username',
            'password',
            'first_name',
            'last_name',
            'email',
            #'is_staff',
            #'is_superuser',
            #'is_active',
        )
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True}
        }

    def create(self, validated_data):
        user = User()
        user.set_password(validated_data['password'])
        non_password_fields = list(self.Meta.fields)
        try:
            non_password_fields.remove('password')
        except ValueError:
            pass
        for field in non_password_fields:
            try:
                setattr(user, field, validated_data[field])
            except KeyError:
                pass
        user.save()
        return user


class UserListSerializer(UserSerializer):
    assets_count = serializers.SerializerMethodField('_assets_count')
    collections_count = serializers.SerializerMethodField('_collections_count')

    def _collections_count(self, obj):
        return obj.owned_collections.count()

    def _assets_count(self, obj):
        return obj.assets.count()

    class Meta(UserSerializer.Meta):
        fields = ('url', 'username', 'assets_count', 'collections_count',)


class CollectionChildrenSerializer(serializers.Serializer):
    def to_representation(self, value):
        if isinstance(value, Collection):
            serializer = CollectionListSerializer
        elif isinstance(value, Asset):
            serializer = AssetListSerializer
        else:
            raise Exception('Unexpected child type {}'.format(type(value)))
        return serializer(value, context=self.context).data


class CollectionSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')
    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        read_only=True
    )
    parent = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        required=False,
        view_name='collection-detail',
        queryset=Collection.objects.all()
    )
    owner__username = serializers.ReadOnlyField(source='owner.username')
    # ancestors are ordered from farthest to nearest
    ancestors = AncestorCollectionsSerializer(
        many=True, read_only=True, source='get_ancestors_or_none')
    children = serializers.SerializerMethodField()
    permissions = ObjectPermissionSerializer(many=True, read_only=True)
    downloads = serializers.SerializerMethodField()
    tag_string = serializers.CharField(required=False)
    access_type = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ('name',
                  'uid',
                  'kind',
                  'url',
                  'parent',
                  'owner',
                  'owner__username',
                  'downloads',
                  'date_created',
                  'date_modified',
                  'ancestors',
                  'children',
                  'permissions',
                  'access_type',
                  'discoverable_when_public',
                  'tag_string',)
        lookup_field = 'uid'
        extra_kwargs = {
            'assets': {
                'lookup_field': 'uid',
            },
            'uid': {
                'read_only': True,
            },
        }

    def _get_tag_names(self, obj):
        return obj.tags.names()

    def get_children(self, obj):
        paginator = LimitOffsetPagination()
        paginator.default_limit = 10
        queryset = CollectionChildrenQuerySet(obj).select_related(
            'owner', 'parent'
        ).prefetch_related(
            'permissions',
            'permissions__permission',
            'permissions__user',
            'permissions__content_object',
        ).all()
        page = paginator.paginate_queryset(
            queryset=queryset,
            request=self.context.get('request', None)
        )
        serializer = CollectionChildrenSerializer(
            page, read_only=True, many=True, context=self.context)
        return OrderedDict([
            ('count', paginator.count),
            ('next', paginator.get_next_link()),
            ('previous', paginator.get_previous_link()),
            ('results', serializer.data)
        ])

    def get_downloads(self, obj):
        request = self.context.get('request', None)
        obj_url = reverse(
            'collection-detail', args=(obj.uid,), request=request)
        return [
            {'format': 'zip', 'url': '%s?format=zip' % obj_url},
        ]

    def get_access_type(self, obj):
        try:
            request = self.context['request']
        except KeyError:
            return None
        if request.user == obj.owner:
            return 'owned'
        # `obj.permissions.filter(...).exists()` would be cleaner, but it'd
        # cost a query. This ugly loop takes advantage of having already called
        # `prefetch_related()`
        for permission in obj.permissions.all():
            if not permission.deny and permission.user == request.user:
                return 'shared'
        for subscription in obj.usercollectionsubscription_set.all():
            # `usercollectionsubscription_set__user` is not prefetched
            if subscription.user_id == request.user.pk:
                return 'subscribed'
        if obj.discoverable_when_public:
            return 'public'
        if request.user.is_superuser:
            return 'superuser'
        raise Exception(u'{} has unexpected access to {}'.format(
            request.user.username, obj.uid))


class SitewideMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitewideMessage
        lookup_field = 'slug'
        fields = ('slug',
                  'body',)

class CollectionListSerializer(CollectionSerializer):
    children_count = serializers.SerializerMethodField()
    assets_count = serializers.SerializerMethodField()

    def get_children_count(self, obj):
        return obj.children.count()

    def get_assets_count(self, obj):
        return Asset.objects.filter(parent=obj).only('pk').count()
        return obj.assets.count()

    class Meta(CollectionSerializer.Meta):
        fields = ('name',
                  'uid',
                  'kind',
                  'url',
                  'parent',
                  'owner',
                  'children_count',
                  'assets_count',
                  'owner__username',
                  'date_created',
                  'date_modified',
                  'permissions',
                  'access_type',
                  'discoverable_when_public',
                  'tag_string',)


class AuthorizedApplicationUserSerializer(serializers.BaseSerializer):
    username = serializers.CharField()
    password = serializers.CharField(style={'input_type': 'password'})
    token = serializers.CharField(read_only=True)
    def to_internal_value(self, data):
        field_names = ('username', 'password')
        validation_errors = {}
        validated_data = {}
        for field_name in field_names:
            value = data.get(field_name)
            if not value:
                validation_errors[field_name] = 'This field is required.'
            else:
                validated_data[field_name] = value
        if len(validation_errors):
            raise exceptions.ValidationError(validation_errors)
        return validated_data


class OneTimeAuthenticationKeySerializer(serializers.ModelSerializer):
    username = serializers.SlugRelatedField(
        slug_field='username', source='user', queryset=User.objects.all())
    class Meta:
        model = OneTimeAuthenticationKey
        fields = ('username', 'key', 'expiry')


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
        super(UserCollectionSubscriptionSerializer, self).__init__(
            *args, **kwargs)
        self.fields['collection'].queryset = get_objects_for_user(
            get_anonymous_user(),
            'view_collection',
            Collection.objects.filter(discoverable_when_public=True)
        )

    class Meta:
        model = UserCollectionSubscription
        lookup_field = 'uid'
        fields = ('url', 'collection', 'uid')
