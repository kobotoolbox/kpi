# coding: utf-8
import json
from collections import OrderedDict

from django.conf import settings
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kpi.constants import (
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC,
    ASSET_STATUS_SHARED,
    ASSET_TYPES,
    ASSET_TYPE_COLLECTION,
    PERM_CHANGE_ASSET,
    PERM_DISCOVER_ASSET,
    PERM_FROM_KC_ONLY,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import (
    PaginatedApiField,
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)
from kpi.models import Asset, AssetVersion
from kpi.models.asset import UserAssetSubscription
from kpi.models.object_permission import get_anonymous_user

from .asset_version import AssetVersionListSerializer
from .asset_permission_assignment import AssetPermissionAssignmentSerializer


class AssetSerializer(serializers.HyperlinkedModelSerializer):

    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail', lookup_field='username', read_only=True)
    owner__username = serializers.ReadOnlyField(source='owner.username')
    url = HyperlinkedIdentityField(
        lookup_field='uid', view_name='asset-detail')
    asset_type = serializers.ChoiceField(choices=ASSET_TYPES)
    settings = WritableJSONField(required=False, allow_blank=True)
    content = WritableJSONField(required=False)
    report_styles = WritableJSONField(required=False)
    report_custom = WritableJSONField(required=False)
    map_styles = WritableJSONField(required=False)
    map_custom = WritableJSONField(required=False)
    xls_link = serializers.SerializerMethodField()
    summary = serializers.ReadOnlyField()
    koboform_link = serializers.SerializerMethodField()
    xform_link = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    downloads = serializers.SerializerMethodField()
    embeds = serializers.SerializerMethodField()
    parent = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        queryset=Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION),
        view_name='asset-detail',
        required=False,
        allow_null=True
    )
    assignable_permissions = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    tag_string = serializers.CharField(required=False, allow_blank=True)
    version_id = serializers.CharField(read_only=True)
    version__content_hash = serializers.CharField(read_only=True)
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
    data = serializers.SerializerMethodField()

    # Only add link instead of hooks list to avoid multiple access to DB.
    hooks_link = serializers.SerializerMethodField()

    children = serializers.SerializerMethodField()
    subscribers_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    access_types = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = ('url',
                  'owner',
                  'owner__username',
                  'parent',
                  'settings',
                  'asset_type',
                  'date_created',
                  'summary',
                  'date_modified',
                  'version_id',
                  'version__content_hash',
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
                  'report_custom',
                  'map_styles',
                  'map_custom',
                  'content',
                  'downloads',
                  'embeds',
                  'koboform_link',
                  'xform_link',
                  'hooks_link',
                  'tag_string',
                  'uid',
                  'kind',
                  'xls_link',
                  'name',
                  'assignable_permissions',
                  'permissions',
                  'settings',
                  'data',
                  'children',
                  'subscribers_count',
                  'status',
                  'access_types',
                  )
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
                raise serializers.ValidationError({
                    'translations': str(err)
                })
            validated_data['content'] = asset_content
        return super().update(asset, validated_data)

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
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
        return reverse('asset-xls',
                       args=(obj.uid,),
                       request=self.context.get('request', None))

    def get_xform_link(self, obj):
        return reverse('asset-xform',
                       args=(obj.uid,),
                       request=self.context.get('request', None))

    def get_hooks_link(self, obj):
        return reverse('hook-list',
                       args=(obj.uid,),
                       request=self.context.get('request', None))

    def get_embeds(self, obj):
        request = self.context.get('request', None)

        def _reverse_lookup_format(fmt):
            url = reverse('asset-%s' % fmt,
                          args=(obj.uid,),
                          request=request)
            return {'format': fmt,
                    'url': url, }

        return [
            _reverse_lookup_format('xls'),
            _reverse_lookup_format('xform'),
        ]

    def get_downloads(self, obj):
        def _reverse_lookup_format(fmt):
            request = self.context.get('request', None)
            obj_url = reverse('asset-detail',
                              args=(obj.uid,),
                              request=request)
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
        return reverse('asset-koboform',
                       args=(obj.uid,),
                       request=self.context.get('request', None))

    def get_data(self, obj):
        kwargs = {'parent_lookup_asset': obj.uid}
        format = self.context.get('format')
        if format:
            kwargs['format'] = format

        return reverse('submission-list',
                       kwargs=kwargs,
                       request=self.context.get('request', None))

    def get_deployed_version_id(self, obj):
        if not obj.has_deployment:
            return
        if isinstance(obj.deployment.version_id, int):
            asset_versions_uids_only = obj.asset_versions.only('uid')
            # this can be removed once the 'replace_deployment_ids'
            # migration has been run
            v_id = obj.deployment.version_id
            try:
                return asset_versions_uids_only.get(
                    _reversion_version_id=v_id
                ).uid
            except AssetVersion.DoesNotExist:
                deployed_version = asset_versions_uids_only.filter(
                    deployed=True
                ).first()
                if deployed_version:
                    return deployed_version.uid
                else:
                    return None
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

        try:
            request = self.context['request']
            user = request.user
            if obj.owner_id == user.id:
                return obj.deployment.submission_count

            # `has_perm` benefits from internal calls which use
            # `django_cache_request`. It won't hit DB multiple times
            if obj.has_perm(user, PERM_VIEW_SUBMISSIONS):
                return obj.deployment.submission_count

            if obj.has_perm(user, PERM_PARTIAL_SUBMISSIONS):
                return obj.deployment.calculated_submission_count(
                    requesting_user_id=user.id)
        except KeyError:
            pass

        return 0

    def get_assignable_permissions(self, asset):
        return [
            {
                'url': reverse('permission-detail',
                               kwargs={'codename': codename},
                               request=self.context.get('request')),
                'label': asset.get_label_for_permission(codename),
            }
            for codename in asset.ASSIGNABLE_PERMISSIONS_BY_TYPE[asset.asset_type]]

    def get_children(self, asset):
        # TODO: store in a cache, perhaps in `summary`
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return {'count': 0}
        return {'count': asset.children.count()}

    def get_subscribers_count(self, asset):
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return 0
        # ToDo Optimize this. What about caching it inside `summary`
        # That sounds great ^^^ In the meantime, use what we already have from
        # `prefetch_related()`
        return asset.subscriptions.count()

    def get_permissions(self, obj):
        context = self.context
        user = context['request'].user

        # TODO: Put this logic in one place (maybe
        # KpiAssignedObjectPermissionsFilter) and allow filtering to be done
        # either in Python (to take advantage of prefetch_related) or via ORM.
        # (Could also put the logic into the query used by prefetch_related)

        # Do not `filter()` to avoid further queries
        all_assignments = obj.permissions.all()
        # Re-implement part of `ObjectPermissionMixin.has_perm()`, you know,
        # just for funsies (really to determine effective permission without
        # making database queries)
        requestor_can_manage = all(
            (
                not a.deny
                for a in all_assignments
                if a.user_id == user.pk
                and a.permission.codename == PERM_MANAGE_ASSET
            )
        )
        if requestor_can_manage:
            visible_assignments = all_assignments
        else:
            # Anonymous users can see only anonymous assignments
            allowed_assignees = [settings.ANONYMOUS_USER_ID]
            # Authenticated users can also see their own permissions and the
            # owner's permissions
            if not user.is_anonymous:
                allowed_assignees += [user.pk, obj.owner_id]
            visible_assignments = (
                a
                for a in all_assignments
                if a.user_id in allowed_assignees
            )

        # Also exclude deny permissions and `from_kc_only`
        visible_assignments = (
            a
            for a in visible_assignments
            if not a.deny and a.permission.codename != PERM_FROM_KC_ONLY
        )

        # Need to pass `asset` and `asset_uid` to context of
        # AssetPermissionAssignmentSerializer serializer to avoid extra queries
        # to DB within the serializer to retrieve the asset object.
        context['asset'] = obj
        context['asset_uid'] = obj.uid

        return AssetPermissionAssignmentSerializer(visible_assignments,
                                                   many=True, read_only=True,
                                                   context=context).data

    def get_access_types(self, obj):
        """
        Handles the detail endpoint but also takes advantage of the
        `AssetViewSet.get_serializer_context()` "cache" for the list endpoint,
        if it is present
        """
        # Avoid extra queries if obj is not a collection
        if obj.asset_type != ASSET_TYPE_COLLECTION:
            return None

        # User is the owner
        try:
            request = self.context['request']
        except KeyError:
            return None

        access_types = []
        if request.user.pk == obj.owner_id:
            access_types.append('owned')

        # User can view the collection.
        try:
            # The list view should provide a cache
            asset_permission_assignments = self.context[
                'object_permissions_per_asset'
            ].get(obj.pk, [])
        except KeyError:
            asset_permission_assignments = obj.permissions.all()

        # We test at the same time whether the collection is public or not
        for obj_permission in asset_permission_assignments:

            if (
                not obj_permission.deny
                and obj_permission.user_id == settings.ANONYMOUS_USER_ID
                and obj_permission.permission.codename == PERM_DISCOVER_ASSET
            ):
                access_types.append('public')

                if request.user.pk == obj.owner_id:
                    # Do not go further, `access_type` cannot be `shared`
                    # and `owned`
                    break

            if (
                request.user != obj.owner
                and not obj_permission.deny
                and obj_permission.user_id == request.user.pk
            ):
                access_types.append('shared')
                # Do not go further, we assume `settings.ANONYMOUS_USER_ID`
                # equals -1. Thus, `public` access type should be discovered at
                # first
                break

        # User has subscribed to this collection
        for subscription in obj.subscriptions.all():
            if subscription.user_id == request.user.pk:
                access_types.append('subscribed')
                break

        # User is big brother.
        if request.user.is_superuser:
            access_types.append('superuser')

        if not access_types:
            raise Exception(
                f'{request.user.username} has unexpected access to {obj.uid}'
            )

        return access_types

    def validate_parent(self, parent: Asset) -> Asset:
        request = self.context['request']
        user = request.user
        if user.is_anonymous:
            user = get_anonymous_user()

        # Validate first if user can update the current parent
        if self.instance and self.instance.parent is not None:
            if not self.instance.parent.has_perm(user, PERM_CHANGE_ASSET):
                raise serializers.ValidationError(
                    _('User cannot update current parent collection'))

        # Target collection is `None`, no need to check permissions
        if parent is None:
            return parent

        # `user` must have write access to target parent before being able to
        # move the asset.
        parent_perms = parent.get_perms(user)
        if PERM_VIEW_ASSET not in parent_perms:
            raise serializers.ValidationError(_('Target collection not found'))

        if PERM_CHANGE_ASSET not in parent_perms:
            raise serializers.ValidationError(
                _('User cannot update target parent collection'))

        return parent

    def _content(self, obj):
        return json.dumps(obj.content)

    def get_status(self, obj) -> str:
        """
        Returns a string summarizing the permission assignments on this object:
            - 'private': only the owner has permissions
            - 'public': anonymous has `view_` but not `discover_`
            - 'public-discoverable': anonymous has `discover_`
            - 'shared': non-owning users have permissions
        """
        # TODO: why is this method needed if we return `permissions` in the
        # list serializer?
        has_anonymous_discover = False
        has_anonymous_other = False
        has_non_owner_access = False
        # Don't `filter()` here to take advantage of `prefetch_related()`
        for perm_assignment in obj.permissions.all():
            if perm_assignment.deny:
                continue
            if perm_assignment.user_id == settings.ANONYMOUS_USER_ID:
                if perm_assignment.permission.codename == 'PERM_DISCOVER_ASSET':
                    has_anonymous_discover = True
                else:
                    has_anonymous_other = True
            elif perm_assignment.user_id != obj.owner_id:
                has_non_owner_access = True

        if has_anonymous_discover:
            return 'public-discoverable'
        elif has_anonymous_other:
            return 'public'
        elif has_non_owner_access:
            return 'shared'
        else:
            return 'private'

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('asset-table-view',
                       args=(obj.uid,),
                       request=request)


import pickle, time
class AssetListSerializer(AssetSerializer):

    def __init__(self, *args, **kwargs):
        self.total_took = 0
        print()
        super().__init__(*args, **kwargs)

    def to_representation(self, *args, **kwargs):
        t0 = time.time(); r = super().to_representation(*args, **kwargs); t1 = time.time()
        took = round((t1 - t0) * 1000)
        self.total_took += took
        print('\rSERI TOOK', took, 'TOTAL', self.total_took, end='    ', flush=True)
        return r

    class Meta(AssetSerializer.Meta):
        # WARNING! If you're changing something here, please update
        # `Asset.optimize_queryset_for_list()`; otherwise, you'll cause an
        # additional database query for each asset in the list.
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
                  'data',
                  'subscribers_count',
                  'status',
                  'access_types',
                  'children'
                  )


class AssetUrlListSerializer(AssetSerializer):

    class Meta(AssetSerializer.Meta):
        fields = ('url',)
