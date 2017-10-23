# -*- coding: utf-8 -*-
import datetime
import json
import pytz
from collections import OrderedDict

from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import get_script_prefix, resolve, Resolver404
from django.db import transaction
from django.db.utils import ProgrammingError
from django.utils.six.moves.urllib import parse as urlparse
from django.conf import settings
from rest_framework import serializers, exceptions
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.reverse import reverse_lazy, reverse
from taggit.models import Tag

from kobo.static_lists import SECTORS, COUNTRIES, LANGUAGES
from hub.models import SitewideMessage, ExtraUserDetail
from .fields import PaginatedApiField
from .models import Asset
from .models import AssetSnapshot
from .models import AssetVersion
from .models import Collection
from .models import CollectionChildrenQuerySet
from .models import UserCollectionSubscription
from .models import ImportTask, ExportTask
from .models import ObjectPermission
from .models.object_permission import get_anonymous_user, get_objects_for_user
from .models.asset import ASSET_TYPES
from .models import TagUid
from .models import OneTimeAuthenticationKey
from .forms import USERNAME_REGEX, USERNAME_MAX_LENGTH
from .forms import USERNAME_INVALID_MESSAGE
from .utils.gravatar_url import gravatar_url

from .deployment_backends.kc_access.utils import get_kc_profile_data
from .deployment_backends.kc_access.utils import set_kc_require_auth


class Paginated(LimitOffsetPagination):

    """ Adds 'root' to the wrapping response object. """
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class WritableJSONField(serializers.Field):

    """ Serializer for JSONField -- required to make field writable"""

    def __init__(self, **kwargs):
        self.allow_blank = kwargs.pop('allow_blank', False)
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
        with transaction.atomic():
            # TEMPORARY Issue #1161: something other than KC is setting a
            # permission; clear the `from_kc_only` flag
            ObjectPermission.objects.filter(
                user=user,
                permission__codename='from_kc_only',
                object_id=content_object.id,
                content_type=ContentType.objects.get_for_model(content_object)
            ).delete()
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

        # Force owner to be the requesting user
        # NB: validated_data is not used when linking to an existing asset
        # without specifying source; in that case, the snapshot owner is the
        # asset's owner, even if a different user makes the request
        validated_data['owner'] = self.context['request'].user

        # TODO: Move to a validator?
        if asset and source:
            if not self.context['request'].user.has_perm('view_asset', asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            validated_data['source'] = source
            snapshot = AssetSnapshot.objects.create(**validated_data)
        elif asset:
            # The client provided an existing asset; read source from it
            if not self.context['request'].user.has_perm('view_asset', asset):
                # The client is not allowed to snapshot this asset
                raise exceptions.PermissionDenied
            # asset.snapshot pulls , by default, a snapshot for the latest
            # version.
            snapshot = asset.snapshot
        elif source:
            # The client provided source directly; no need to copy anything
            # For tidiness, pop off unused fields. `None` avoids KeyError
            validated_data.pop('asset', None)
            validated_data.pop('asset_version', None)
            snapshot = AssetSnapshot.objects.create(**validated_data)
        else:
            raise serializers.ValidationError('Specify an asset and/or a source')

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


class AssetVersionListSerializer(serializers.Serializer):
    # If you change these fields, please update the `only()` and
    # `select_related()` calls  in `AssetVersionViewSet.get_queryset()`
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    date_deployed = serializers.SerializerMethodField(read_only=True)
    date_modified = serializers.CharField(read_only=True)

    def get_date_deployed(self, obj):
        return obj.deployed and obj.date_modified

    def get_url(self, obj):
        return reverse('asset-version-detail', args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))


class AssetVersionSerializer(AssetVersionListSerializer):
    content = serializers.SerializerMethodField(read_only=True)

    def get_content(self, obj):
        return obj.version_content

    def get_version_id(self, obj):
        return obj.uid

    class Meta:
        model = AssetVersion
        fields = (
                    'version_id',
                    'date_deployed',
                    'date_modified',
                    'content',
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
    report_styles = WritableJSONField(required=False)
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
    deployed_versions = PaginatedApiField(
        serializer_class=AssetVersionListSerializer,
        # Higher-than-normal limit since the client doesn't yet know how to
        # request more than the first page
        default_limit=100
    )
    deployment__identifier = serializers.SerializerMethodField()
    deployment__active = serializers.SerializerMethodField()
    deployment__links = serializers.SerializerMethodField()
    deployment__data_download_links = serializers.SerializerMethodField()
    deployment__submission_count = serializers.SerializerMethodField()

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
                  'deployment__data_download_links',
                  'deployment__submission_count',
                  'report_styles',
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
                  'permissions',
                  'settings',)
        extra_kwargs = {
            'parent': {
                'lookup_field': 'uid',
            },
            'uid': {
                'read_only': True,
            },
        }

    def update(self, asset, validated_data):
        asset_content = asset.content
        _req_data = self.context['request'].data
        _has_translations = 'translations' in _req_data
        _has_content = 'content' in _req_data
        if _has_translations and not _has_content:
            translations_list = json.loads(_req_data['translations'])
            try:
                asset.update_translation_list(translations_list)
            except ValueError as err:
                raise serializers.ValidationError(err.message)
            validated_data['content'] = asset_content
        return super(AssetSerializer, self).update(asset, validated_data)

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
        if not obj.has_deployment:
            return
        if obj.asset_versions.filter(deployed=True).exists():
            if isinstance(obj.deployment.version_id, int):
                # this can be removed once the 'replace_deployment_ids'
                # migration has been run
                v_id = obj.deployment.version_id
                try:
                    return obj.asset_versions.get(_reversion_version_id=v_id).uid
                except ObjectDoesNotExist, e:
                    return obj.asset_versions.filter(deployed=True).first().uid
            else:
                return obj.deployment.version_id

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

    def get_deployment__data_download_links(self, obj):
        if obj.has_deployment:
            return obj.deployment.get_data_download_links()
        else:
            return {}

    def get_deployment__submission_count(self, obj):
        if not obj.has_deployment:
            return 0
        return obj.deployment.submission_count

    def _content(self, obj):
        return json.dumps(obj.content)

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('asset-table-view', args=(obj.uid,), request=request)


class DeploymentSerializer(serializers.Serializer):
    backend = serializers.CharField(required=False)
    identifier = serializers.CharField(read_only=True)
    active = serializers.BooleanField(required=False)
    version_id = serializers.CharField(required=False)

    @staticmethod
    def _raise_unless_current_version(asset, validated_data):
        # Stop if the requester attempts to deploy any version of the asset
        # except the current one
        if 'version_id' in validated_data and \
                validated_data['version_id'] != str(asset.version_id):
            raise NotImplementedError(
                'Only the current version_id can be deployed')

    def create(self, validated_data):
        asset = self.context['asset']
        self._raise_unless_current_version(asset, validated_data)
        # if no backend is provided, use the installation's default backend
        backend_id = validated_data.get('backend',
                                        settings.DEFAULT_DEPLOYMENT_BACKEND)

        # asset.deploy deploys the latest version and updates that versions'
        # 'deployed' boolean value
        asset.deploy(backend=backend_id,
                     active=validated_data.get('active', False))
        asset.save(create_version=False,
                   adjust_content=False)
        return asset.deployment

    def update(self, instance, validated_data):
        ''' If a `version_id` is provided and differs from the current
        deployment's `version_id`, the asset will be redeployed. Otherwise,
        only the `active` field will be updated '''
        asset = self.context['asset']
        deployment = asset.deployment

        if 'backend' in validated_data and \
                validated_data['backend'] != deployment.backend:
            raise exceptions.ValidationError(
                {'backend': 'This field cannot be modified after the initial '
                            'deployment.'})

        if ('version_id' in validated_data and
                validated_data['version_id'] != deployment.version_id):
            # Request specified a `version_id` that differs from the current
            # deployment's; redeploy
            self._raise_unless_current_version(asset, validated_data)
            asset.deploy(
                backend=deployment.backend,
                active=validated_data.get('active', deployment.active)
            )
        elif 'active' in validated_data:
            # Set the `active` flag without touching the rest of the deployment
            deployment.set_active(validated_data['active'])

        asset.save(create_version=False, adjust_content=False)
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


class ExportTaskSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='exporttask-detail'
    )
    messages = ReadOnlyJSONField(required=False)

    class Meta:
        model = ExportTask
        fields = (
            'url',
            'status',
            'messages',
            'uid',
            'date_created',
            'last_submission_time',
            'result',
        )
        extra_kwargs = {
            'status': {
                'read_only': True,
            },
            'uid': {
                'read_only': True,
            },
            'last_submission_time': {
                'read_only': True,
            },
            'result': {
                'read_only': True,
            },
        }


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
                  'deployment__submission_count',
                  'permissions',
                  'downloads',
                  )


class AssetUrlListSerializer(AssetSerializer):
    class Meta(AssetSerializer.Meta):
        fields = ('url',)


class UserSerializer(serializers.HyperlinkedModelSerializer):
    assets = PaginatedApiField(
        serializer_class=AssetUrlListSerializer
    )

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


class CurrentUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    server_time = serializers.SerializerMethodField()
    date_joined = serializers.SerializerMethodField()
    projects_url = serializers.SerializerMethodField()
    support = serializers.SerializerMethodField()
    gravatar = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()
    extra_details = WritableJSONField(source='extra_details.data')
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    git_rev = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'server_time',
            'date_joined',
            'projects_url',
            'support',
            'is_superuser',
            'gravatar',
            'is_staff',
            'last_login',
            'languages',
            'extra_details',
            'current_password',
            'new_password',
            'git_rev',
        )

    def get_server_time(self, obj):
        # Currently unused on the front end
        return datetime.datetime.now(tz=pytz.UTC).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(pytz.UTC).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_projects_url(self, obj):
        return '/'.join((settings.KOBOCAT_URL, obj.username))

    def get_support(self, obj):
        return {
            'email': settings.KOBO_SUPPORT_EMAIL,
            'url': settings.KOBO_SUPPORT_URL,
        }

    def get_gravatar(self, obj):
        return gravatar_url(obj.email)

    def get_languages(self, obj):
        return settings.LANGUAGES

    def get_git_rev(self, obj):
        request = self.context.get('request', False)
        if settings.EXPOSE_GIT_REV or (request and request.user.is_superuser):
            return settings.GIT_REV
        else:
            return False

    def to_representation(self, obj):
        if obj.is_anonymous():
            return {'message': 'user is not logged in'}
        rep = super(CurrentUserSerializer, self).to_representation(obj)
        if settings.UPCOMING_DOWNTIME:
            # setting is in the format:
            # [dateutil.parser.parse('6pm edt').isoformat(), countdown_msg]
            rep['upcoming_downtime'] = settings.UPCOMING_DOWNTIME
        # TODO: Find a better location for SECTORS and COUNTRIES
        # as the functionality develops. (possibly in tags?)
        rep['available_sectors'] = SECTORS
        rep['available_countries'] = COUNTRIES
        rep['all_languages'] = LANGUAGES
        if not rep['extra_details']:
            rep['extra_details'] = {}
        # `require_auth` needs to be read from KC every time
        if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL:
            rep['extra_details']['require_auth'] = get_kc_profile_data(
                obj.pk).get('require_auth', False)

        # Count the number of dkobo SurveyDrafts to determine migration status
        from kpi.management.commands.import_survey_drafts_from_dkobo import \
            SurveyDraft
        try:
            SurveyDraft.objects.exists()
        except ProgrammingError:
            # dkobo is not installed. Freude, schöner Götterfunken
            pass
        else:
            survey_drafts = SurveyDraft.objects.filter(user=obj)
            rep['dkobo_survey_drafts'] = {
                'total': survey_drafts.count(),
                'non_migrated': survey_drafts.filter(kpi_asset_uid='').count(),
                'migrate_url': u'{switch_builder}?beta=1&migrate=1'.format(
                    switch_builder=reverse(
                        'toggle-preferred-builder',
                        request=self.context.get('request', None)
                    )
                )
            }
        return rep

    def update(self, instance, validated_data):
        # "The `.update()` method does not support writable dotted-source
        # fields by default." --DRF
        extra_details = validated_data.pop('extra_details', False)
        if extra_details:
            extra_details_obj, created = ExtraUserDetail.objects.get_or_create(
                user=instance)
            # `require_auth` needs to be written back to KC
            if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL and \
                    'require_auth' in extra_details['data']:
                set_kc_require_auth(
                    instance.pk, extra_details['data']['require_auth'])
            extra_details_obj.data.update(extra_details['data'])
            extra_details_obj.save()
        current_password = validated_data.pop('current_password', False)
        new_password = validated_data.pop('new_password', False)
        if all((current_password, new_password)):
            with transaction.atomic():
                if instance.check_password(current_password):
                    instance.set_password(new_password)
                    instance.save()
                else:
                    raise serializers.ValidationError({
                        'current_password': 'Incorrect current password.'
                    })
        elif any((current_password, new_password)):
            raise serializers.ValidationError(
                'current_password and new_password must both be sent ' \
                'together; one or the other cannot be sent individually.'
            )
        return super(CurrentUserSerializer, self).update(
            instance, validated_data)


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
    children = PaginatedApiField(
        serializer_class=CollectionChildrenSerializer,
        # "The value `source='*'` has a special meaning, and is used to indicate
        # that the entire object should be passed through to the field"
        # (http://www.django-rest-framework.org/api-guide/fields/#source).
        source='*',
        source_processor=lambda source: CollectionChildrenQuerySet(
            source).select_related(
                'owner', 'parent'
            ).prefetch_related(
                'permissions',
                'permissions__permission',
                'permissions__user',
                'permissions__content_object',
            ).all()
    )
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
