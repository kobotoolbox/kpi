from __future__ import annotations

import json
import re
from typing import Optional

from constance import config
from django.conf import settings
from django.db import transaction
from django.db.models import F, QuerySet
from django.utils.translation import gettext as t
from django.utils.translation import ngettext as nt
from django_request_cache import cache_for_request
from rest_framework import exceptions, serializers
from rest_framework.fields import empty
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse
from rest_framework.utils.serializer_helpers import ReturnList

from kobo.apps.organizations.constants import ORG_ADMIN_ROLE
from kobo.apps.organizations.utils import get_real_owner
from kobo.apps.reports.constants import FUZZY_VERSION_PATTERN
from kobo.apps.reports.report_data import build_formpack
from kobo.apps.subsequences.utils.deprecation import WritableAdvancedFeaturesField
from kobo.apps.trash_bin.exceptions import TrashIntegrityError, TrashTaskInProgressError
from kobo.apps.trash_bin.models.project import ProjectTrash
from kobo.apps.trash_bin.utils import move_to_trash, put_back
from kpi.constants import (
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC,
    ASSET_STATUS_SHARED,
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_SURVEY,
    ASSET_TYPES,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_METADATA_ASSET,
    PERM_DISCOVER_ASSET,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import (
    PaginatedApiField,
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)
from kpi.models import (
    Asset,
    AssetExportSettings,
    AssetVersion,
    ObjectPermission,
    UserAssetSubscription,
)
from kpi.models.asset import AssetDeploymentStatus
from kpi.utils.object_permission import (
    get_cached_code_names,
    get_database_user,
    get_user_permission_assignments,
    get_user_permission_assignments_queryset,
)
from kpi.utils.project_views import (
    get_project_view_user_permissions_for_asset,
    user_has_project_view_asset_perm,
    view_has_perm,
)

from .asset_export_settings import AssetExportSettingsSerializer
from .asset_file import AssetFileSerializer
from .asset_permission_assignment import AssetPermissionAssignmentSerializer
from .asset_version import AssetVersionListSerializer


class AssetBulkActionsSerializer(serializers.Serializer):
    SUPPORTED_ACTIONS = ['archive', 'unarchive', 'delete', 'undelete']
    payload = WritableJSONField()

    def __init__(
        self,
        instance=None,
        data=empty,
        grace_period=None,
        **kwargs
    ):
        request = kwargs.get('context').get('request')
        self.__user = request.user
        self.__grace_period = grace_period
        super().__init__(instance=instance, data=data, **kwargs)

    def create(self, validated_data):
        delete_request, put_back_ = self._get_action_type_and_direction(
            validated_data['payload']
        )
        extra_params = {}
        if asset_uids := validated_data['payload'].get('asset_uids'):
            extra_params['asset_uids'] = asset_uids
        else:
            extra_params['owner'] = self.__user

        queryset, projects_count = ProjectTrash.toggle_asset_statuses(
            active=put_back_,
            toggle_delete=delete_request,
            **extra_params,
        )
        validated_data['project_counts'] = projects_count

        if delete_request:
            self._toggle_trash(queryset, put_back_)

        return validated_data

    def validate_payload(self, payload: dict) -> dict:
        self._validate_action(payload)
        try:
            asset_uids = payload['asset_uids']
        except KeyError:
            self._validate_confirm(payload)
            asset_uids = []

        self._has_perms(payload, asset_uids)
        self._validate_asset_types(payload, asset_uids)

        return payload

    def to_representation(self, instance):
        delete_request, put_back_ = self._get_action_type_and_direction(
            instance['payload']
        )

        if delete_request:
            if put_back_:
                message = nt(
                    '%(count)d project has been undeleted',
                    '%(count)d projects have been undeleted',
                    instance['project_counts'],
                ) % {'count': instance['project_counts']}
            else:
                message = nt(
                    '%(count)d project has been deleted',
                    '%(count)d projects have been deleted',
                    instance['project_counts'],
                ) % {'count': instance['project_counts']}
        else:
            if put_back_:
                message = nt(
                    '%(count)d project has been unarchived',
                    '%(count)d projects have been unarchived',
                    instance['project_counts'],
                ) % {'count': instance['project_counts']}
            else:
                message = nt(
                    '%(count)d project has been archived',
                    '%(count)d projects have been archived',
                    instance['project_counts'],
                ) % {'count': instance['project_counts']}

        return {'detail': message}

    def _create_tasks(self, assets: list[dict]):
        try:
            move_to_trash(
                self.__user, assets, config.PROJECT_TRASH_GRACE_PERIOD, 'asset'
            )
        except TrashIntegrityError:
            # We do not want to ignore conflicts. If so, something went wrong.
            # Probably direct API calls not coming from the front end.
            raise serializers.ValidationError(
                {'detail': t('One or many projects have been deleted already!')}
            )

    def _delete_tasks(self, assets: list[dict]):
        try:
            put_back(self.__user, assets, 'asset')
        except TrashTaskInProgressError:
            raise serializers.ValidationError(
                {'detail': t('One or many projects are already being deleted!')}
            )

    def _get_action_type_and_direction(self, payload: dict) -> tuple:

        action = payload['action']
        put_back_ = False
        delete_request = False
        if action.startswith('un'):
            put_back_ = True
        if action.endswith('delete'):
            delete_request = True

        return delete_request, put_back_

    def _has_perms(self, payload: dict, asset_uids: list[str]):

        delete_request, _ = self._get_action_type_and_direction(payload)

        if self.__user.is_anonymous:
            raise exceptions.PermissionDenied()

        # No need to validate permissions if `asset_uids` is empty (which means
        # all user's assets will be processed.
        # Obviously, superusers are granted all permissions implicitly.
        if not asset_uids or self.__user.is_superuser:
            return

        user_filter = [self.__user]
        if self.__user.organization.is_admin(self.__user):
            user_filter.append(self.__user.organization.owner_user_object)

        if not delete_request:
            if ProjectTrash.objects.filter(asset__uid__in=asset_uids).exists():
                raise exceptions.PermissionDenied()

            code_names = get_cached_code_names(Asset)
            perm_dict = code_names[PERM_MANAGE_ASSET]
            objects_count = ObjectPermission.objects.filter(
                user__in=user_filter,
                permission_id=perm_dict['id'],
                asset__uid__in=asset_uids,
                deny=False
            ).count()
        else:
            objects_count = Asset.objects.filter(
                owner__in=user_filter,
                uid__in=asset_uids,
            ).count()

        if objects_count != len(asset_uids):
            raise exceptions.PermissionDenied()

    def _toggle_trash(self, queryset: QuerySet, put_back_: bool):

        # The main goal of the annotation below is to pass always the same
        # metadata attributes to AuditLog model whatever the model and the action.
        # `self._delete_tasks and self._create_tasks` both call utilities which
        # save entries in auditlog table. When fetching auditlog API endpoint
        # the query parser can be used to search on same attributes.
        # E.g: retrieve all actions on asset 'aSWwcERCgsGTsgIx` would be done
        # with `q=metadata__asset_uid:aSWwcERCgsGTsgIx`. It will return
        # all delete submissions and action on the asset itself.
        assets = queryset.annotate(
            asset_uid=F('uid'), asset_name=F('name')
        ).values('pk', 'asset_uid', 'asset_name')

        if put_back_:
            self._delete_tasks(assets)
        else:
            self._create_tasks(assets)

    def _validate_action(self, payload: dict):
        try:
            action = payload['action']
        except KeyError:
            raise serializers.ValidationError(
                t('`action` parameter is required')
            )

        if action not in self.SUPPORTED_ACTIONS:
            raise serializers.ValidationError(
                t('Supported values for `action` are: ')
                + ', '.join(self.SUPPORTED_ACTIONS)
            )

        if (
            action == 'undelete'
            and not self.__user.is_superuser
        ):
            raise exceptions.PermissionDenied()

    def _validate_asset_types(self, payload: dict, asset_uids: list[str]):
        delete_request, put_back_ = self._get_action_type_and_direction(payload)

        if put_back_ or delete_request or not asset_uids:
            return

        if Asset.objects.filter(
            asset_type=ASSET_TYPE_SURVEY,
            uid__in=asset_uids,
            _deployment_status=AssetDeploymentStatus.DRAFT,
        ).exists():
            raise serializers.ValidationError(
                t('Draft projects cannot be archived')
            )

    def _validate_confirm(self, payload: dict):

        if not payload.get('confirm'):
            raise serializers.ValidationError(t('Confirmation is required'))


class AssetSerializer(serializers.HyperlinkedModelSerializer):

    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-kpi-detail', lookup_field='username', read_only=True)
    owner__username = serializers.ReadOnlyField(source='owner.username')
    owner_label = serializers.SerializerMethodField()
    url = HyperlinkedIdentityField(
        lookup_field='uid', view_name='asset-detail')
    asset_type = serializers.ChoiceField(choices=ASSET_TYPES)
    settings = WritableJSONField(required=False, allow_blank=True)
    content = WritableJSONField(required=False)
    report_styles = WritableJSONField(required=False)
    report_custom = WritableJSONField(required=False)
    map_styles = WritableJSONField(required=False)
    map_custom = WritableJSONField(required=False)
    advanced_features = WritableAdvancedFeaturesField(required=False)
    advanced_submission_schema = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    analysis_form_json = serializers.SerializerMethodField()
    xls_link = serializers.SerializerMethodField()
    summary = serializers.ReadOnlyField()
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
    effective_permissions = serializers.SerializerMethodField()
    exports = serializers.SerializerMethodField()
    export_settings = serializers.SerializerMethodField()
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
    deployment__active = serializers.SerializerMethodField()
    deployment__links = serializers.SerializerMethodField()
    deployment__data_download_links = serializers.SerializerMethodField()
    deployment__submission_count = serializers.SerializerMethodField()
    deployment_status = serializers.SerializerMethodField()
    data = serializers.SerializerMethodField()

    # Only add link instead of hooks list to avoid multiple access to DB.
    hooks_link = serializers.SerializerMethodField()

    children = serializers.SerializerMethodField()
    subscribers_count = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    access_types = serializers.SerializerMethodField()
    data_sharing = WritableJSONField(required=False)
    paired_data = serializers.SerializerMethodField()
    project_ownership = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = ('url',
                  'owner',
                  'owner__username',
                  'parent',
                  'settings',
                  'asset_type',
                  'files',
                  'summary',
                  'date_created',
                  'date_modified',
                  'date_deployed',
                  'version_id',
                  'version__content_hash',
                  'version_count',
                  'has_deployment',
                  'deployed_version_id',
                  'deployed_versions',
                  'deployment__links',
                  'deployment__active',
                  'deployment__data_download_links',
                  'deployment__submission_count',
                  'deployment_status',
                  'report_styles',
                  'report_custom',
                  'advanced_features',
                  'advanced_submission_schema',
                  'analysis_form_json',
                  'map_styles',
                  'map_custom',
                  'content',
                  'downloads',
                  'embeds',
                  'xform_link',
                  'hooks_link',
                  'tag_string',
                  'uid',
                  'kind',
                  'xls_link',
                  'name',
                  'assignable_permissions',
                  'permissions',
                  'effective_permissions',
                  'exports',
                  'export_settings',
                  'settings',
                  'data',
                  'children',
                  'subscribers_count',
                  'status',
                  'access_types',
                  'data_sharing',
                  'paired_data',
                  'project_ownership',
                  'owner_label',
                  )
        extra_kwargs = {
            'parent': {
                'lookup_field': 'uid',
            },
            'uid': {
                'read_only': True,
            },
        }

    def create(self, validated_data):
        current_owner = validated_data['owner']
        real_owner = get_real_owner(current_owner)
        if real_owner != current_owner:
            with transaction.atomic():
                validated_data['owner'] = real_owner
                instance = super().create(validated_data)
                instance.assign_perm(current_owner, PERM_MANAGE_ASSET)
        else:
            instance = super().create(validated_data)

        return instance

    def update(self, asset, validated_data):
        request = self.context['request']
        user = request.user

        validated_data['last_modified_by'] = user.username
        self._set_asset_ids_cache(asset)

        if (
            not asset.has_perm(user, PERM_CHANGE_ASSET)
            and user_has_project_view_asset_perm(asset, user, PERM_CHANGE_METADATA_ASSET)
        ):
            _validated_data = {}
            if settings := validated_data.get('settings'):
                _validated_data['settings'] = settings
            if name := validated_data.get('name'):
                _validated_data['name'] = name
            return super().update(asset, _validated_data)

        asset_content = asset.content
        _req_data = request.data
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

    def get_files(self, obj):
        return AssetFileSerializer(
            obj.asset_files.all(),
            many=True,
            read_only=True,
            context=self.context,
        ).data

    def get_advanced_submission_schema(self, obj):
        req = self.context.get('request')
        url = req.build_absolute_uri(f'/advanced_submission_post/{obj.uid}')
        return obj.get_advanced_submission_schema(url=url)

    def get_analysis_form_json(self, obj):
        return obj.analysis_form_json()

    def get_deployment_status(self, obj: Asset) -> str:
        if deployment_status := obj.deployment_status:
            return deployment_status
        return '-'

    def get_effective_permissions(self, obj: Asset) -> list[dict[str, str]]:
        """
        Return a list of combined asset and project view permissions that the
        requesting user has for the asset.
        """
        user = get_database_user(self.context['request'].user)
        project_view_perms = get_project_view_user_permissions_for_asset(
            obj, user
        )
        asset_perms = obj.get_perms(user)
        return [
            {'codename': perm} for perm in set(project_view_perms + asset_perms)
        ]

    def get_version_count(self, obj):
        try:
            return len(obj.prefetched_latest_versions)
        except AttributeError:
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
        except KeyError:
            return None

        user = request.user
        if obj.owner_id == user.id:
            return obj.deployment.submission_count

        # `has_perm` benefits from internal calls which use
        # `django_cache_request`. It won't hit DB multiple times

        self._set_asset_ids_cache(obj)

        if obj.has_perm(user, PERM_VIEW_SUBMISSIONS):
            return obj.deployment.submission_count

        return None

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
        """
        Handles the detail endpoint but also takes advantage of the
        `AssetViewSet.get_serializer_context()` "cache" for the list endpoint,
        if it is present
        """
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return {'count': 0}

        try:
            children_count_per_asset = self.context['children_count_per_asset']
        except KeyError:
            children_count = asset.children.count()
        else:
            children_count = children_count_per_asset.get(asset.pk, 0)

        return {'count': children_count}

    def get_subscribers_count(self, asset):
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return 0
        # ToDo Optimize this. What about caching it inside `summary`
        return UserAssetSubscription.objects.filter(asset_id=asset.pk).count()

    def get_status(self, asset):

        # `order_by` lets us check `AnonymousUser`'s permissions first.
        # No need to read all permissions if `AnonymousUser`'s permissions
        # are found.
        # We assume that `settings.ANONYMOUS_USER_ID` equals -1.
        perm_assignments = (
            asset.permissions.values('user_id', 'permission__codename')
            .exclude(user_id=asset.owner_id)
            .order_by('user_id', 'permission__codename')
        )

        return self._get_status(perm_assignments)

    def get_paired_data(self, asset):
        request = self.context.get('request')
        return reverse('paired-data-list', args=(asset.uid,), request=request)

    def get_permissions(self, obj):
        context = self.context
        request = self.context.get('request')

        self._set_asset_ids_cache(obj)

        queryset = get_user_permission_assignments_queryset(obj, request.user)
        # Need to pass `asset` and `asset_uid` to context of
        # AssetPermissionAssignmentSerializer serializer to avoid extra queries
        # to DB within the serializer to retrieve the asset object.
        context['asset'] = obj
        context['asset_uid'] = obj.uid

        return AssetPermissionAssignmentSerializer(
            queryset.all(), many=True, read_only=True, context=context
        ).data

    def get_project_ownership(self, asset) -> Optional[dict]:
        if not (transfer := asset.transfers.order_by('-date_created').first()):
            return

        request = self.context.get('request')
        user = get_database_user(request.user)

        # Do not provide info if user is not concerned by last invite
        if not (
            transfer.invite.sender_id == user.pk
            or transfer.invite.recipient_id == user.pk
        ):
            return

        return {
            'invite': reverse(
                'project-ownership-invite-detail',
                args=(transfer.invite.uid,),
                request=self.context.get('request', None),
            ),
            'sender': transfer.invite.sender.username,
            'recipient': transfer.invite.recipient.username,
            'status': transfer.invite.status
        }

    def get_exports(self, obj: Asset) -> str:
        return reverse(
            'asset-export-list',
            args=(obj.uid,),
            request=self.context.get('request', None),
        )

    def get_export_settings(self, obj: Asset) -> ReturnList:
        return AssetExportSettingsSerializer(
            AssetExportSettings.objects.filter(asset=obj),
            many=True,
            read_only=True,
            context=self.context,
        ).data

    def get_access_types(self, asset):
        """
        Handles the detail endpoint but also takes advantage of the
        `AssetViewSet.get_serializer_context()` "cache" for the list endpoint,
        if it is present
        """
        # Avoid extra queries if obj is not a collection
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return None

        # User is the owner
        try:
            request = self.context['request']
        except KeyError:
            return None

        access_types = []
        if request.user == asset.owner:
            access_types.append('owned')

        # User can view the collection.
        try:
            # The list view should provide a cache
            asset_permission_assignments = self.context[
                'object_permissions_per_asset'
            ].get(asset.pk)
        except KeyError:
            asset_permission_assignments = asset.permissions.all()

        # We test at the same time whether the collection is public or not
        for obj_permission in asset_permission_assignments:

            if (
                not obj_permission.deny
                and obj_permission.user_id == settings.ANONYMOUS_USER_ID
                and obj_permission.permission.codename == PERM_DISCOVER_ASSET
            ):
                access_types.append('public')

                if request.user == asset.owner:
                    # Do not go further, `access_type` cannot be `shared`
                    # and `owned`
                    break

            if (
                request.user != asset.owner
                and not obj_permission.deny
                and obj_permission.user == request.user
            ):
                access_types.append('shared')
                # Do not go further, we assume `settings.ANONYMOUS_USER_ID`
                # equals -1. Thus, `public` access type should be discovered at
                # first
                break

        # User has subscribed to this collection
        subscribed = False
        try:
            # The list view should provide a cache
            subscriptions = self.context['user_subscriptions_per_asset'].get(
                asset.pk, []
            )
        except KeyError:
            subscribed = asset.has_subscribed_user(request.user.pk)
        else:
            subscribed = request.user.pk in subscriptions
        if subscribed:
            access_types.append('subscribed')

        # User is big brother.
        if request.user.is_superuser:
            access_types.append('superuser')

        try:
            organization = self.context['organizations_per_asset'].get(asset.id)
        except KeyError:
            # Fallback on context if it exists (i.e.: asset lists of an organization).
            # Otherwise, retrieve from the asset owner.
            organization = self.context.get(
                'organization', asset.owner.organization
            )

        if organization.get_user_role(request.user) == ORG_ADMIN_ROLE:
            access_types.extend(['shared', 'org-admin'])
            access_types = list(set(access_types))

        if not access_types:
            raise Exception(
                f'{request.user.username} has unexpected access to {obj.uid}'
            )

        return access_types

    def get_owner_label(self, asset):
        try:
            organization = self.context['organizations_per_asset'].get(asset.id)
        except KeyError:
            # Fallback on context if it exists (i.e.: asset lists of an organization).
            # Otherwise, retrieve from the asset owner.
            organization = self.context.get(
                'organization', asset.owner.organization
            )

        if (
            organization
            and organization.is_owner(asset.owner)
            and organization.is_mmo
        ):
            return organization.name
        return asset.owner.username

    def validate_data_sharing(self, data_sharing: dict) -> dict:
        """
        Validates `data_sharing`. It is really basic.
        Only the type of each property is validated. No data is validated.
        It is consistent with partial permissions and REST services.

        The client bears the responsibility of providing valid data.
        """
        errors = {}
        if not self.instance or not data_sharing:
            return data_sharing

        if 'enabled' not in data_sharing:
            errors['enabled'] = t('The property is required')

        if 'fields' in data_sharing:
            if not isinstance(data_sharing['fields'], list):
                errors['fields'] = t('The property must be an array')
            else:
                asset = self.instance
                fields = data_sharing['fields']
                # We used to get all fields for every version for valid fields,
                # but the UI shows the latest version only, so only its fields
                # can be picked up. It is easier then to compare valid fields with
                # user's choice.
                form_pack, _unused = build_formpack(
                    asset, submission_stream=[], use_all_form_versions=False
                )
                # We do not want to include the version field.
                # See `_infer_version_id()` in `kobo.apps.reports.report_data.build_formpack`
                # for field name alternatives.
                valid_fields = [
                    f.path for f in form_pack.get_fields_for_versions(
                        form_pack.versions.keys()
                    ) if not re.match(FUZZY_VERSION_PATTERN, f.path)
                ]
                unknown_fields = set(fields) - set(valid_fields)
                if unknown_fields and valid_fields:
                    errors['fields'] = t(
                        'Some fields are invalid, '
                        'choices are: `{valid_fields}`'
                    ).format(valid_fields='`,`'.join(valid_fields))

                # Force `fields` to be an empty list to avoid useless parsing when
                # fetching external xml endpoint (i.e.: /api/v2/assets/<asset_uid>/paired-data/<paired_data_uid>/external.xml)
                if sorted(valid_fields) == sorted(fields):
                    data_sharing['fields'] = []
        else:
            data_sharing['fields'] = []

        if errors:
            raise serializers.ValidationError(errors)

        return data_sharing

    def validate_parent(self, parent: Asset) -> Asset:
        user = get_database_user(self.context['request'].user)
        # Validate first if user can update the current parent
        if self.instance and self.instance.parent is not None:
            if not self.instance.parent.has_perm(user, PERM_CHANGE_ASSET):
                raise serializers.ValidationError(
                    t('User cannot update current parent collection'))

        # Target collection is `None`, no need to check permissions
        if parent is None:
            return parent

        # `user` must have write access to target parent before being able to
        # move the asset.
        parent_perms = parent.get_perms(user)
        if PERM_VIEW_ASSET not in parent_perms:
            raise serializers.ValidationError(t('Target collection not found'))

        if PERM_CHANGE_ASSET not in parent_perms:
            raise serializers.ValidationError(
                t('User cannot update target parent collection'))

        return parent

    def validate_settings(self, settings: dict) -> dict:
        if not self.instance or not settings:
            return settings
        return {**self.instance.settings, **settings}

    def _content(self, obj):
        # FIXME: Is this dead code?
        return json.dumps(obj.content)

    def _get_status(self, perm_assignments):
        """
        Returns asset status.

        **Asset's owner's permissions must be excluded from `perm_assignments`**

        Args:
            perm_assignments (list): List of dicts `{<user_id>, <codename}`
                                     ordered by `user_id`
                                     e.g.: [{-1, 'view_asset'},
                                            {2, 'view_asset'}]

        Returns:
            str: Status slug among these:
                 - 'private'
                 - 'public'
                 - 'public-discoverable'
                 - 'shared'

        """
        if not perm_assignments:
            return ASSET_STATUS_PRIVATE

        for perm_assignment in perm_assignments:
            if perm_assignment.get('user_id') == settings.ANONYMOUS_USER_ID:
                if perm_assignment.get('permission__codename') == PERM_DISCOVER_ASSET:
                    return ASSET_STATUS_DISCOVERABLE

                if perm_assignment.get('permission__codename') == PERM_VIEW_ASSET:
                    return ASSET_STATUS_PUBLIC

            return ASSET_STATUS_SHARED

    def _set_asset_ids_cache(self, asset):
        """
        Set an attribute on the `asset` object for performance purposes
        so that `ObjectPermissionMixin.__get_object_permissions()` can restrict
        the number of objects it retrieves when calling `__get_all_user_permissions()`
        """
        try:
            asset_ids = self.context['asset_ids_cache']
        except KeyError:
            asset_ids = [asset.pk]

        setattr(asset, 'asset_ids_cache', asset_ids)

    def _table_url(self, obj):
        request = self.context.get('request', None)
        return reverse('asset-table-view', args=(obj.uid,), request=request)


class AssetListSerializer(AssetSerializer):

    class Meta(AssetSerializer.Meta):
        # WARNING! If you're changing something here, please update
        # `Asset.optimize_queryset_for_list()`; otherwise, you'll cause an
        # additional database query for each asset in the list.
        fields = ('url',
                  'date_created',
                  'date_modified',
                  'date_deployed',
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
                  'deployment__active',
                  'deployment__submission_count',
                  'deployment_status',
                  'permissions',
                  'export_settings',
                  'downloads',
                  'data',
                  'subscribers_count',
                  'status',
                  'access_types',
                  'children',
                  'data_sharing',
                  'owner_label',
                  )

    def get_permissions(self, asset):
        try:
            asset_permission_assignments = self.context[
                'object_permissions_per_asset'
            ].get(asset.pk)
        except KeyError:
            # Maybe overkill, there are no reasons to enter here.
            # in the list context, `object_permissions_per_asset` should
            # always be a property of `self.context`
            return super().get_permissions(asset)

        context = self.context
        request = self.context.get('request')

        # Need to pass `asset` and `asset_uid` to context of
        # AssetPermissionAssignmentSerializer serializer to avoid extra queries
        # to DB within the serializer to retrieve the asset object.
        context['asset'] = asset
        context['asset_uid'] = asset.uid

        self._set_asset_ids_cache(asset)

        user_assignments = get_user_permission_assignments(
            asset, request.user, asset_permission_assignments
        )
        return AssetPermissionAssignmentSerializer(
            user_assignments, many=True, read_only=True, context=context
        ).data

    def get_subscribers_count(self, asset):
        if asset.asset_type != ASSET_TYPE_COLLECTION:
            return 0

        try:
            subscriptions_per_asset = self.context['user_subscriptions_per_asset']
            return len(subscriptions_per_asset.get(asset.pk, []))
        except KeyError:
            # Maybe overkill, there are no reasons to enter here.
            # in the list context, `user_subscriptions_per_asset` should be
            # always a property of `self.context`
            return super().get_subscribers_count(asset)

    def get_status(self, asset):

        try:
            asset_perm_assignments = self.context[
                'object_permissions_per_asset'].get(asset.pk)
        except KeyError:
            # Maybe overkill, there are no reasons to enter here.
            # in the list context, `object_permissions_per_asset` should be
            # always a property of `self.context`
            return super().get_status(asset)

        perm_assignments = []

        # Prepare perm_assignments for `_get_status()`
        for perm_assignment in asset_perm_assignments:
            if perm_assignment.user_id != asset.owner_id:
                perm_assignments.append({
                    'user_id': perm_assignment.user_id,
                    'permission__codename': perm_assignment.permission.codename
                })

        perm_assignments.sort(key=lambda pa: pa.get('user_id'))

        return self._get_status(perm_assignments)


class AssetUrlListSerializer(AssetSerializer):

    class Meta(AssetSerializer.Meta):
        fields = ('url',)


class AssetMetadataListSerializer(AssetListSerializer):

    languages = serializers.SerializerMethodField()
    owner__name = serializers.SerializerMethodField()
    owner__email = serializers.SerializerMethodField()
    owner__organization = serializers.SerializerMethodField()

    class Meta(AssetSerializer.Meta):
        fields = (
            'url',
            'date_created',
            'date_modified',
            'date_deployed',
            'owner',
            'owner__username',
            'owner__email',
            'owner__name',
            'owner__organization',
            'uid',
            'name',
            'settings',
            'languages',
            'has_deployment',
            'deployment__active',
            'deployment__submission_count',
            'deployment_status',
            'asset_type',
            'downloads',
            'owner_label',
        )

    def get_deployment__submission_count(self, obj: Asset) -> int:
        if obj.has_deployment and view_has_perm(
            self._get_view(), PERM_VIEW_SUBMISSIONS
        ):
            return obj.deployment.submission_count
        return super().get_deployment__submission_count(obj)

    def get_languages(self, obj: Asset) -> list[str]:
        return obj.summary.get('languages', [])

    def get_owner__email(self, obj: Asset) -> str:
        return obj.owner.email

    def get_owner__name(self, obj: Asset) -> str:
        return self._get_user_detail(obj, 'name')

    def get_owner__organization(self, obj: Asset) -> str:
        return self._get_user_detail(obj, 'organization')

    @staticmethod
    def _get_user_detail(obj, attr: str) -> str:
        owner = obj.owner
        if hasattr(owner, 'extra_details'):
            return owner.extra_details.data.get(attr, '')
        return ''

    def _get_view(self) -> str:
        request = self.context['request']
        return request.parser_context['kwargs']['uid']

    # FIXME Remove this method, seems to not be used anywhere
    @cache_for_request
    def _user_has_asset_perms(self, obj: Asset, perm: str) -> bool:
        request = self.context.get('request')
        user = get_database_user(request.user)
        self._set_asset_ids_cache(obj)
        if obj.owner == user or obj.has_perm(user, perm):
            return True
        return False
