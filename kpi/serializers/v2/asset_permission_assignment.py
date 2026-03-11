from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import Permission
from django.db import transaction
from django.urls import Resolver404
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ASSET_TYPES_WITH_CHILDREN,
    PERM_ADD_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PREFIX_PARTIAL_PERMS,
    SUFFIX_SUBMISSIONS_PERMS,
)
from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models.asset import Asset, AssetUserPartialPermission
from kpi.models.object_permission import ObjectPermission
from kpi.utils.object_permission import (
    get_user_permission_assignments_queryset,
    post_assign_partial_perm,
    post_assign_perm,
    post_remove_partial_perms,
    post_remove_perm,
)
from kpi.utils.permissions import is_user_anonymous
from kpi.utils.urls import absolute_resolve

ASSIGN_OWNER_ERROR_MESSAGE = "Owner's permissions cannot be assigned explicitly"


class AssetPermissionAssignmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-kpi-detail',
        lookup_field='username',
        queryset=User.objects.filter(is_active=True),
        style={'base_template': 'input.html'},  # Render as a simple text box
    )
    permission = RelativePrefixHyperlinkedRelatedField(
        view_name='permission-detail',
        lookup_field='codename',
        queryset=Permission.objects.all(),
        style={'base_template': 'input.html'},  # Render as a simple text box
    )
    partial_permissions = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
            'partial_permissions',
            'label',
        )

        read_only_fields = ('uid', 'label')

    def create(self, validated_data):
        user = validated_data['user']
        asset = validated_data['asset']
        if asset.owner_id == user.id:
            raise serializers.ValidationError(
                {'user': t(ASSIGN_OWNER_ERROR_MESSAGE)}
            )
        permission = validated_data['permission']
        partial_permissions = validated_data.get('partial_permissions', None)

        return asset.assign_perm(
            user, permission.codename, partial_perms=partial_permissions
        )

    def get_label(self, object_permission):
        # `self.object_permission.label` calls `self.object_permission.asset`
        # internally. Thus, costs an extra query each time the object is
        # serialized. `asset` is already loaded and attached to context,
        # let's use it!
        try:
            asset = self.context['asset']
        except KeyError:
            return object_permission.label
        else:
            return asset.get_label_for_permission(
                object_permission.permission.codename
            )

    def get_partial_permissions(self, object_permission):
        codename = object_permission.permission.codename
        if codename.startswith(PREFIX_PARTIAL_PERMS):
            view = self.context.get('view')
            # if view doesn't have an `asset` property,
            # fallback to context. (e.g. AssetViewSet)
            asset = getattr(view, 'asset', self.context.get('asset'))

            partial_perms_per_asset = self.context.get('partial_perms_per_asset')
            if partial_perms_per_asset is not None:
                partial_perms = partial_perms_per_asset.get(asset.pk, {}).get(
                    object_permission.user_id
                )
            else:
                partial_perms = asset.get_partial_perms(
                    object_permission.user_id, with_filters=True
                )

            if not partial_perms:
                return None

            hyperlinked_partial_perms = []
            for perm_codename, filters in partial_perms.items():
                url = self.__get_permission_hyperlink(perm_codename)
                hyperlinked_partial_perms.append({'url': url, 'filters': filters})
            return hyperlinked_partial_perms
        return None

    def get_url(self, object_permission):
        asset_uid = self.context.get('asset_uid')
        return reverse(
            'asset-permission-assignment-detail',
            args=(asset_uid, object_permission.uid),
            request=self.context.get('request', None),
        )

    def validate(self, attrs):
        # Because `partial_permissions` is a `SerializerMethodField`,
        # it's read-only, so it's not validated nor added to `validated_data`.
        # We need to do it manually
        self.validate_partial_permissions(attrs)
        return attrs

    def validate_partial_permissions(self, attrs):
        """
        Validates permissions and filters sent with partial permissions.

        If data is valid, `partial_permissions` attribute is added to `attrs`.
        Useful to permission assignment in `create()`.

        :param attrs: dict of `{'user': '<username>',
                                'permission': <permission object>}`
        :return: dict, the `attrs` parameter updated (if necessary) with
                 validated `partial_permissions` dicts.
        """
        permission = attrs['permission']
        if not permission.codename.startswith(PREFIX_PARTIAL_PERMS):
            # No additional validation needed
            return attrs

        def _invalid_partial_permissions(message):
            raise serializers.ValidationError({'partial_permissions': message})

        request = self.context['request']
        partial_permissions = None

        if isinstance(request.data, dict):  # for a single assignment
            partial_permissions = request.data.get('partial_permissions')
        elif self.context.get(
            'partial_permissions'
        ):  # injected during bulk assignment
            partial_permissions = self.context.get('partial_permissions')

        if not partial_permissions:
            _invalid_partial_permissions(
                t("This field is required for the '{}' permission").format(
                    permission.codename
                )
            )

        partial_permissions_attr = defaultdict(list)

        for (
            partial_permission,
            filters_,
        ) in self.__get_partial_permissions_generator(partial_permissions):
            try:
                resolver_match = absolute_resolve(partial_permission.get('url'))
            except (TypeError, Resolver404):
                _invalid_partial_permissions(t('Invalid `url`'))

            try:
                codename = resolver_match.kwargs['codename']
            except KeyError:
                _invalid_partial_permissions(t('Invalid `url`'))

            # Permission must valid and must be assignable.
            if not self._validate_permission(
                codename, SUFFIX_SUBMISSIONS_PERMS
            ):
                _invalid_partial_permissions(t('Invalid `url`'))

            # No need to validate Mongo syntax, query will fail
            # if syntax is not correct.
            if not isinstance(filters_, dict):
                _invalid_partial_permissions(t('Invalid `filters`'))

            # Validation passed!
            partial_permissions_attr[codename].append(filters_)

        # Everything went well. Add it to `attrs`
        attrs.update({'partial_permissions': partial_permissions_attr})

        return attrs

    def validate_permission(self, permission):
        """
        Checks if permission can be assigned on asset.
        """
        if not self._validate_permission(permission.codename):
            raise serializers.ValidationError(
                t(
                    '{permission} cannot be assigned explicitly to '
                    'Asset objects of this type.'
                ).format(permission=permission.codename)
            )
        return permission

    def to_representation(self, instance):
        """
        Doesn't display 'partial_permissions' attribute if it's `None`.
        """
        try:
            # Each time we try to access `instance.label`, `instance.content_object`
            # is needed. Django can't find it from objects cache even if it already
            # exists. Because of `GenericForeignKey`, `select_related` can't be
            # used to load it within the same queryset. So Django hits DB each
            # time a label is shown. `prefetch_related` helps, but not that much.
            # It still needs to load object from DB at least once.
            # It means, when listing assets, it would add as many extra queries
            # as assets. `content_object`, in that case, is the parent asset and
            # we can access it through the context. Let's use it.
            asset = self.context['asset']
            setattr(instance, 'content_object', asset)
        except KeyError:
            pass

        repr_ = super().to_representation(instance)
        repr_copy = dict(repr_)
        for k, v in repr_copy.items():
            if k == 'partial_permissions' and v is None:
                del repr_[k]

        return repr_

    def _validate_permission(self, codename, suffix=None):
        """
        Validates if `codename` can be assigned on `Asset`s.
        Search can be restricted to assignable codenames which end with `suffix`

        :param codename: str. See `Asset.ASSIGNABLE_PERMISSIONS
        :param suffix: str.
        :return: bool.
        """
        return (
            # DONOTMERGE abusive to the database server?
            codename
            in Asset.objects.only('asset_type')
            .get(uid=self.context['asset_uid'])
            .get_assignable_permissions(with_partial=True)
            and (suffix is None or codename.endswith(suffix))
        )

    def __get_partial_permissions_generator(self, partial_permissions):
        """
        Creates a generator to iterate over partial_permissions list.
        Useful to validate each item and stop iterating as soon as errors
        are detected

        :param partial_permissions: list
        :return: generator
        """
        for partial_permission in partial_permissions:
            for filters_ in partial_permission.get('filters'):
                yield partial_permission, filters_

    def __get_permission_hyperlink(self, codename):
        """
        Builds permission hyperlink representation.
        :param codename: str
        :return: str. url
        """
        return reverse(
            'permission-detail',
            args=(codename,),
            request=self.context.get('request', None),
        )


class AssetPermissionAssignmentReadSerializer(serializers.Serializer):
    """
    Lightweight read-only serializer for permission assignments. Accepts raw
    dicts from .values() queries instead of full ORM objects, avoiding the
    overhead of model instantiation. Used in both list and detail asset views.
    """

    url = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    permission = serializers.SerializerMethodField()
    partial_permissions = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    def get_url(self, perm) -> str:
        return reverse(
            'asset-permission-assignment-detail',
            args=(self.context['asset_uid'], perm['uid']),
            request=self.context.get('request'),
        )

    def get_user(self, perm) -> str:
        return reverse(
            'user-kpi-detail',
            kwargs={'username': perm['user__username']},
            request=self.context.get('request'),
        )

    def get_permission(self, perm) -> str:
        return reverse(
            'permission-detail',
            args=(perm['permission__codename'],),
            request=self.context.get('request'),
        )

    def get_partial_permissions(self, perm) -> list | None:
        codename = perm['permission__codename']
        if not codename.startswith(PREFIX_PARTIAL_PERMS):
            return None
        asset = self.context.get('asset')
        partial_perms_per_asset = self.context.get('partial_perms_per_asset')
        if partial_perms_per_asset is not None:
            user_partial_perms = partial_perms_per_asset.get(asset.pk, {}).get(
                perm['user_id']
            )
        else:
            user_partial_perms = asset.get_partial_perms(
                perm['user_id'], with_filters=True
            )
        if not user_partial_perms:
            return None
        return [
            {
                'url': reverse(
                    'permission-detail',
                    args=(perm_codename,),
                    request=self.context.get('request'),
                ),
                'filters': filters,
            }
            for perm_codename, filters in user_partial_perms.items()
        ]

    def get_label(self, perm) -> list:
        return self.context['asset'].get_label_for_permission(
            perm['permission__codename']
        )

    def to_representation(self, instance):
        repr_ = super().to_representation(instance)
        if repr_.get('partial_permissions') is None:
            del repr_['partial_permissions']
        return repr_


class PartialPermissionField(serializers.Field):
    default_error_messages = {
        'invalid': t('Not a valid list.'),
        'blank': t('This field may not be blank.'),
    }
    initial = ''

    def __init__(self, **kwargs):
        super().__init__(required=False, **kwargs)

    def to_internal_value(self, data):
        if not isinstance(data, list):
            self.fail('invalid')
        return data

    def to_representation(self, value):
        return value


class PermissionAssignmentSerializer(serializers.Serializer):
    user = serializers.CharField()
    permission = serializers.CharField()
    partial_permissions = PartialPermissionField()


class AssetBulkInsertPermissionSerializer(serializers.Serializer):
    """
    This goal of this class is not to expose data in API endpoint,
    but to process all validation checks and convert URLs into objects at once
    to avoid multiple queries to DB vs AssetPermissionAssignmentSerializer(many=True)
    which makes a query to DB to match each RelativePrefixHyperlinkedRelatedField()
    with an Django model object.

    Warning: If less queries are sent to DB, it consumes more CPU and memory.
    The bigger the assignments are, the bigger the resources footprint will be.
    """

    assignments = serializers.ListField(child=PermissionAssignmentSerializer())

    @dataclass(frozen=True)
    class PermissionAssignment:
        """
        A more-explicit alternative to a simple tuple
        """

        user_pk: int
        permission_codename: str
        partial_permissions_json: Optional[str] = None

    @transaction.atomic
    def create(self, validated_data):
        asset = self.context['asset']
        user_pk_to_obj_cache = dict()
        incoming_assignments = self.get_set_of_incoming_assignments(
            asset, validated_data['assignments'], user_pk_to_obj_cache
        )
        existing_assignments = self.get_set_of_existing_assignments(
            asset, user_pk_to_obj_cache
        )

        removals = existing_assignments.difference(incoming_assignments)
        additions = incoming_assignments.difference(existing_assignments)

        if removals:
            self._bulk_remove(asset, removals, additions, user_pk_to_obj_cache)

        if additions:
            self._bulk_assign(asset, additions, user_pk_to_obj_cache)

        # Propagate permissions to child assets (collections only).
        # For other asset types, `_bulk_assign()` already wrote the
        # ObjectPermissions directly, so `recalculate_descendants_perms()`
        # would be a no-op and is skipped.
        #
        # `asset.recalculate_descendants_perms()` cannot be used here because
        # it reads permissions through `__get_all_object_permissions()`, which
        # is decorated with `@cache_for_request`. That cache was populated
        # during `get_set_of_existing_assignments()` — before `_bulk_assign()`
        # inserted the new records — so it does not reflect the current DB
        # state. Calling it would propagate an incomplete permission set to
        # children, causing them to miss the newly assigned permissions.
        # Instead, we query the DB directly and call each child's
        # `_recalculate_inherited_perms()` with the fresh result.
        if (removals or additions) and asset.asset_type in ASSET_TYPES_WITH_CHILDREN:
            grant_perms = set(
                ObjectPermission.objects.filter(asset=asset, deny=False).values_list(
                    'user_id', 'permission_id'
                )
            )
            deny_perms = set(
                ObjectPermission.objects.filter(asset=asset, deny=True).values_list(
                    'user_id', 'permission_id'
                )
            )
            effective_perms = grant_perms - deny_perms
            children = list(asset.children.only('pk', 'owner', 'parent'))
            for child in children:
                child._recalculate_inherited_perms(
                    parent_effective_perms=effective_perms
                )
                child.recalculate_descendants_perms()

        # Return nothing, in a nice way, because the view is responsible for
        # calling `list()` to return the assignments as they actually exist in
        # the database. That causes duplicate queries but at least ensures that
        # the front end displays accurate information even if there are bugs
        # here
        return {}

    def get_set_of_existing_assignments(
        self, asset: 'kpi.models.Asset', user_pk_to_obj_cache: dict
    ) -> set[PermissionAssignment]:
        # Get all existing partial permissions with a single query and store
        # in a dictionary where the keys are the primary key of each user
        existing_partial_perms_for_user = dict(
            asset.asset_partial_permissions.values_list('user', 'permissions')
        )

        # Build a set of all existing assignments
        existing_assignments = set()
        for assignment_in_db in (
            # It seems unnecessary to filter assignments like this since a
            # user who can change assignments can also view all
            # assignments. Maybe that will change in the future, though?
            get_user_permission_assignments_queryset(
                asset, self.context['request'].user
            )
            .exclude(user=asset.owner)
            .select_related('user', 'permission')
            .only('asset', 'user', 'permission__codename')
        ):
            # Expand the stupid cache to include any users present in the
            # existing assignments but not in the incoming assignments
            user_pk_to_obj_cache[
                assignment_in_db.user_id
            ] = assignment_in_db.user

            if assignment_in_db.permission.codename == PERM_PARTIAL_SUBMISSIONS:
                partial_permissions_json = json.dumps(
                    existing_partial_perms_for_user[assignment_in_db.user_id],
                    sort_keys=True,
                )
            else:
                partial_permissions_json = None
            existing_assignments.add(
                self.PermissionAssignment(
                    assignment_in_db.user_id,
                    assignment_in_db.permission.codename,
                    partial_permissions_json,
                )
            )

        return existing_assignments

    def get_set_of_incoming_assignments(
        self,
        asset: 'kpi.models.Asset',
        posted_assignments: list,
        user_pk_to_obj_cache: dict,
    ) -> set[PermissionAssignment]:
        # Build a set of all incoming assignments, including implied
        # assignments not explicitly sent by the front end
        incoming_assignments = set()
        for incoming_assignment in posted_assignments:
            incoming_permission = incoming_assignment['permission']
            partial_permissions = None

            # TODO: refactor permission assignment code so that it does not
            # always require a fully-fledged `User` object? Until then, keep a
            # stupid object cache thing because `assign_perm()` and
            # `remove_perm()` REQUIRE user objects
            user_pk_to_obj_cache[
                incoming_assignment['user'].pk
            ] = incoming_assignment['user']

            # Expand to include implied permissions
            for implied_codename in asset.get_implied_perms(
                incoming_permission.codename, for_instance=asset
            ):
                incoming_assignments.add(
                    self.PermissionAssignment(
                        user_pk=incoming_assignment['user'].pk,
                        permission_codename=implied_codename,
                    )
                )

            # Expand to include implied partial permissions
            if incoming_permission.codename == PERM_PARTIAL_SUBMISSIONS:
                partial_permissions = json.dumps(
                    AssetUserPartialPermission.update_partial_perms_to_include_implied(
                        asset, incoming_assignment['partial_permissions']
                    ),
                    sort_keys=True,
                )

            incoming_assignments.add(
                self.PermissionAssignment(
                    user_pk=incoming_assignment['user'].pk,
                    permission_codename=incoming_permission.codename,
                    partial_permissions_json=partial_permissions,
                )
            )

        return incoming_assignments

    def validate(self, attrs):
        """
        Validate users and permissions, and convert them from API URLs into
        model instances, using a minimal number of database queries
        """
        # A dictionary for looking up API user URLs by username
        username_to_url = dict()
        # …for looking up by API permission URLs by codename
        codename_to_url = dict()

        assignable_permissions = self.context[
            'asset'
        ].get_assignable_permissions(with_partial=True)

        # Perhaps not the best error messages, but they're what DRF was already
        # returning
        INVALID_PERMISSION_ERROR = {
            'permission': t('Invalid hyperlink - Object does not exist.')
        }
        INVALID_USER_ERROR = {
            'user': t('Invalid hyperlink - Object does not exist.')
        }
        # This matches the behavior of `AssetPermissionAssignmentSerializer`
        INVALID_PARTIAL_PERMISSION_ERROR = {
            'partial_permissions': t('Invalid `url`')
        }

        # Fill in the dictionaries by parsing the incoming assignments
        for assignment in attrs['assignments']:
            perm_url = assignment['permission']
            user_url = assignment['user']
            codename = self._get_arg_from_url('codename', perm_url)
            if codename not in assignable_permissions:
                raise serializers.ValidationError(INVALID_PERMISSION_ERROR)
            codename_to_url[codename] = perm_url
            username = self._get_arg_from_url('username', user_url)
            username_to_url[username] = user_url
            for partial_assignment in assignment.get('partial_permissions', []):
                if 'filters' not in partial_assignment:
                    # Instead of this, we should validate using DRF
                    raise serializers.ValidationError(
                        'Permission assignment must contain filters'
                    )
                partial_codename = self._get_arg_from_url(
                    'codename', partial_assignment['url']
                )
                if not (
                    partial_codename in assignable_permissions
                    and partial_codename.endswith(SUFFIX_SUBMISSIONS_PERMS)
                ):
                    raise serializers.ValidationError(
                        INVALID_PARTIAL_PERMISSION_ERROR
                    )
                codename_to_url[partial_codename] = partial_assignment['url']

        # Create a dictionary of API user URLs to `User` objects
        url_to_user = dict()
        for user in User.objects.only('pk', 'username').filter(
            username__in=username_to_url.keys(), is_active=True
        ):
            url = username_to_url[user.username]
            url_to_user[url] = user
        if len(url_to_user) != len(username_to_url):
            raise serializers.ValidationError(INVALID_USER_ERROR)

        # Create a dictionary of API permission URLs to `Permission` objects
        url_to_permission = dict()
        for permission in (
            Permission.objects.filter(codename__in=assignable_permissions)
            .filter(codename__in=codename_to_url.keys())
            .order_by('codename')
        ):
            url = codename_to_url[permission.codename]
            url_to_permission[url] = permission
        if len(url_to_permission) != len(codename_to_url):
            # This should never happen since all codenames were found within
            # `assignable_permissions`
            raise RuntimeError(
                'Unexpected mismatch while processing permissions'
            )

        # Rewrite the incoming assignments, replacing user and permission URLs
        # with their corresponding model instance objects
        assignments_with_objects = []
        for assignment in attrs['assignments']:
            assignment_with_objects = {
                'user': url_to_user[assignment['user']],
                'permission': url_to_permission[assignment['permission']],
            }
            if (
                assignment_with_objects['permission'].codename
                == PERM_PARTIAL_SUBMISSIONS
            ):
                assignment_with_objects['partial_permissions'] = defaultdict(
                    list
                )
                for partial_assignment in assignment['partial_permissions']:
                    partial_codename = url_to_permission[
                        partial_assignment['url']
                    ].codename
                    assignment_with_objects['partial_permissions'][
                        partial_codename
                    ] = partial_assignment.get('filters')
            assignments_with_objects.append(assignment_with_objects)

        attrs['assignments'] = assignments_with_objects
        return attrs

    @staticmethod
    def _bulk_assign(asset, additions, user_pk_to_obj_cache):
        """
        Assign permissions in bulk, replacing N assign_perm() calls with a
        single bulk_create() for ObjectPermission records plus one
        update_or_create() per user for partial permissions.

        Owner validation is performed before any DB writes.
        Signals (post_assign_perm, post_assign_partial_perm) are fired per
        (user, codename) after the bulk write, preserving audit-log behaviour.
        """
        for addition in additions:
            if asset.owner_id == addition.user_pk:
                raise serializers.ValidationError(
                    {'user': t(ASSIGN_OWNER_ERROR_MESSAGE)}
                )
            user_obj = user_pk_to_obj_cache[addition.user_pk]
            if is_user_anonymous(user_obj):
                fq_permission = f'kpi.{addition.permission_codename}'
                if fq_permission not in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                    raise serializers.ValidationError(
                        {
                            'permission': (
                                f'Anonymous users cannot be granted the'
                                f' permission {addition.permission_codename}.'
                            )
                        }
                    )

        addition_user_pks = {a.user_pk for a in additions}
        codenames = {a.permission_codename for a in additions}

        # Ensure PERM_ADD_SUBMISSIONS is fetched: it may be needed when
        # partial perms contain change_submissions (which implies it).
        codenames.add(PERM_ADD_SUBMISSIONS)

        perm_map = {
            p.codename: p
            for p in Permission.objects.filter(
                content_type__app_label='kpi',
                codename__in=codenames,
            )
        }

        # Existing direct non-denied permissions for all affected users (1 query)
        existing_set = set(
            ObjectPermission.objects.filter(
                asset=asset,
                user_id__in=addition_user_pks,
                inherited=False,
                deny=False,
            ).values_list('user_id', 'permission__codename')
        )

        # Bulk-delete contradictory perms for users receiving partial_submissions
        partial_sub_user_pks = {
            a.user_pk
            for a in additions
            if a.permission_codename == PERM_PARTIAL_SUBMISSIONS
        }
        if partial_sub_user_pks:
            contradictory = asset.CONTRADICTORY_PERMISSIONS.get(
                PERM_PARTIAL_SUBMISSIONS, ()
            )
            ObjectPermission.objects.filter(
                asset=asset,
                user_id__in=partial_sub_user_pks,
                permission__codename__in=contradictory,
                inherited=False,
            ).delete()

        # Build ObjectPermission records to bulk-create.
        # uid must be set explicitly: bulk_create() bypasses pre_save(), so
        # KpiUidField would not auto-generate the uid, causing a silent
        # ignore_conflicts failure on the unique constraint.
        uid_field = ObjectPermission._meta.get_field('uid')
        new_ops = []
        for addition in additions:
            if (addition.user_pk, addition.permission_codename) not in existing_set:
                perm_obj = perm_map.get(addition.permission_codename)
                if perm_obj:
                    op = ObjectPermission(
                        asset=asset,
                        user_id=addition.user_pk,
                        permission=perm_obj,
                        deny=False,
                        inherited=False,
                    )
                    op.uid = uid_field.generate_uid()
                    new_ops.append(op)

        if new_ops:
            ObjectPermission.objects.bulk_create(new_ops, ignore_conflicts=True)

        # Handle partial permissions (one update_or_create per user)
        # Also creates PERM_ADD_SUBMISSIONS ObjectPermission when implied by
        # partial perms (e.g. change_submissions implies add_submissions).
        extra_add_sub_ops = []
        for addition in additions:
            if addition.permission_codename != PERM_PARTIAL_SUBMISSIONS:
                continue
            user_obj = user_pk_to_obj_cache[addition.user_pk]
            raw_partial = (
                json.loads(addition.partial_permissions_json)
                if addition.partial_permissions_json
                else {}
            )
            new_partial = (
                AssetUserPartialPermission.update_partial_perms_to_include_implied(
                    asset, raw_partial
                )
            )
            AssetUserPartialPermission.objects.update_or_create(
                asset_id=asset.pk,
                user_id=addition.user_pk,
                defaults={'permissions': new_partial},
            )
            post_assign_partial_perm.send(
                sender=asset.__class__,
                perms=new_partial,
                instance=asset,
                user=user_obj,
            )
            # add_submissions has no meaningful partial filter but must exist
            # as an ObjectPermission when change_submissions is in partial perms
            if PERM_ADD_SUBMISSIONS in new_partial:
                key = (addition.user_pk, PERM_ADD_SUBMISSIONS)
                if key not in existing_set:
                    add_sub_perm = perm_map.get(PERM_ADD_SUBMISSIONS)
                    if add_sub_perm:
                        op = ObjectPermission(
                            asset=asset,
                            user_id=addition.user_pk,
                            permission=add_sub_perm,
                            deny=False,
                            inherited=False,
                        )
                        op.uid = uid_field.generate_uid()
                        extra_add_sub_ops.append(op)

        if extra_add_sub_ops:
            ObjectPermission.objects.bulk_create(
                extra_add_sub_ops, ignore_conflicts=True
            )
            for op in extra_add_sub_ops:
                post_assign_perm.send(
                    sender=asset.__class__,
                    instance=asset,
                    user=user_pk_to_obj_cache[op.user_id],
                    codename=PERM_ADD_SUBMISSIONS,
                    deny=False,
                )

        # Fire post_assign_perm signals (audit log + enketo for anon user)
        for addition in additions:
            post_assign_perm.send(
                sender=asset.__class__,
                instance=asset,
                user=user_pk_to_obj_cache[addition.user_pk],
                codename=addition.permission_codename,
                deny=False,
            )

    @staticmethod
    def _bulk_remove(asset, removals, additions, user_pk_to_obj_cache):
        """
        Remove permissions in bulk, avoiding one remove_perm() call per user.

        Users being fully removed (no incoming assignments) use a fast path:
        their direct ObjectPermissions and AssetUserPartialPermissions are
        deleted in two bulk queries.  Users with inherited permissions or users
        whose permissions are only partially modified fall back to the
        individual remove_perm(defer_recalc=True) path so that inherited-perm
        deny records are created correctly.
        """
        incoming_user_pks = {a.user_pk for a in additions}

        codenames_per_user = defaultdict(set)
        for removal in removals:
            codenames_per_user[removal.user_pk].add(removal.permission_codename)

        fully_removed_pks = {
            pk for pk in codenames_per_user if pk not in incoming_user_pks
        }
        modified_pks = {pk for pk in codenames_per_user if pk in incoming_user_pks}

        # Fast path ─ users being fully removed with no inherited perms
        if fully_removed_pks:
            inherited_perm_pks = set(
                ObjectPermission.objects.filter(
                    asset=asset,
                    user_id__in=fully_removed_pks,
                    inherited=True,
                    deny=False,
                )
                .values_list('user_id', flat=True)
                .distinct()
            )
            fast_pks = fully_removed_pks - inherited_perm_pks
            slow_pks = inherited_perm_pks

            if fast_pks:
                had_partial_perm_pks = set(
                    asset.asset_partial_permissions.filter(
                        user_id__in=fast_pks
                    ).values_list('user_id', flat=True)
                )
                ObjectPermission.objects.filter(
                    asset=asset,
                    user_id__in=fast_pks,
                    inherited=False,
                ).delete()
                asset.asset_partial_permissions.filter(user_id__in=fast_pks).delete()
                for user_pk in fast_pks:
                    user_obj = user_pk_to_obj_cache[user_pk]
                    for codename in codenames_per_user[user_pk]:
                        post_remove_perm.send(
                            sender=asset.__class__,
                            instance=asset,
                            user=user_obj,
                            codename=codename,
                        )
                    if user_pk in had_partial_perm_pks:
                        post_remove_partial_perms.send(
                            sender=asset.__class__,
                            instance=asset,
                            user=user_obj,
                        )

            # Slow path ─ users with inherited perms need deny records
            for user_pk in slow_pks:
                user_obj = user_pk_to_obj_cache[user_pk]
                for codename in codenames_per_user[user_pk]:
                    asset.remove_perm(user_obj, codename, defer_recalc=True)

        # Slow path ─ partially modified users
        for user_pk in modified_pks:
            user_obj = user_pk_to_obj_cache[user_pk]
            for codename in codenames_per_user[user_pk]:
                asset.remove_perm(user_obj, codename, defer_recalc=True)

    @staticmethod
    def _get_arg_from_url(arg_name: str, url: str) -> str:
        try:
            resolver_match = absolute_resolve(url)
            value = resolver_match.kwargs[arg_name]
        except (TypeError, KeyError, Resolver404):
            value = None
        return value
