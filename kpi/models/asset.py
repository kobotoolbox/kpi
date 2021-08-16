# coding: utf-8
# 😬
import copy
from collections import defaultdict
from functools import reduce
from operator import add
from typing import Optional, Union

from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils.translation import ugettext_lazy as _
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager
from formpack.utils.flatten_content import flatten_content
from formpack.utils.json_hash import json_hash
from formpack.utils.kobo_locking import strip_kobo_locking_profile

from kobo.apps.reports.constants import (SPECIFIC_REPORTS_KEY,
                                         DEFAULT_REPORTS_KEY)
from kpi.constants import (
    ASSET_TYPES,
    ASSET_TYPES_WITH_CONTENT,
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_QUESTION,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    ASSET_TYPE_TEXT,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_DISCOVER_ASSET,
    PERM_FROM_KC_ONLY,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
    SUFFIX_SUBMISSIONS_PERMS,
)
from kpi.deployment_backends.mixin import DeployableMixin
from kpi.exceptions import (
    BadPermissionsException,
    DeploymentDataException,
)
from kpi.fields import (
    KpiUidField,
    LazyDefaultJSONBField,
)
from kpi.mixins import (
    FormpackXLSFormUtilsMixin,
    ObjectPermissionMixin,
    XlsExportableMixin,
)
from kpi.models.asset_file import AssetFile
from kpi.models.asset_snapshot import AssetSnapshot
from kpi.utils.asset_content_analyzer import AssetContentAnalyzer
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.object_permission import get_cached_code_names
from kpi.utils.sluggify import sluggify_label
from .asset_user_partial_permission import AssetUserPartialPermission
from .asset_version import AssetVersion


# TODO: Would prefer this to be a mixin that didn't derive from `Manager`.
class AssetManager(models.Manager):
    def create(self, *args, children_to_create=None, tag_string=None, **kwargs):
        update_parent_languages = kwargs.pop('update_parent_languages', True)

        # 3 lines below are copied from django.db.models.query.QuerySet.create()
        # because we need to pass an argument to save()
        # (and the default Django create() does not allow that)
        created = self.model(**kwargs)
        self._for_write = True
        created.save(force_insert=True, using=self.db,
                     update_parent_languages=update_parent_languages)

        if tag_string:
            created.tag_string = tag_string
        if children_to_create:
            new_assets = []
            for asset in children_to_create:
                asset['parent'] = created
                new_assets.append(Asset.objects.create(
                    update_parent_languages=False, **asset))
            created.update_languages(new_assets)
        return created

    def deployed(self):
        """
        Filter for deployed assets (i.e. assets having at least one deployed
        version) in an efficient way that doesn't involve joining or counting.
        https://docs.djangoproject.com/en/2.2/ref/models/expressions/#django.db.models.Exists
        """
        deployed_versions = AssetVersion.objects.filter(
            asset=OuterRef('pk'), deployed=True
        )
        return self.annotate(deployed=Exists(deployed_versions)).filter(
            deployed=True
        )

    def filter_by_tag_name(self, tag_name):
        return self.filter(tags__name=tag_name)


class KpiTaggableManager(_TaggableManager):
    @require_instance_manager
    def add(self, *tags, **kwargs):
        """ A wrapper that replaces spaces in tag names with dashes and also
        strips leading and trailng whitespace. Behavior should match the
        TagsInput transform function in app.es6. """
        tags_out = []
        for t in tags:
            # Modify strings only; the superclass' add() method will then
            # create Tags or use existing ones as appropriate.  We do not fix
            # existing Tag objects, which could also be passed into this
            # method, because a fixed name could collide with the name of
            # another Tag object already in the database.
            if isinstance(t, str):
                t = t.strip().replace(' ', '-')
            tags_out.append(t)
        super().add(*tags_out, **kwargs)


class Asset(ObjectPermissionMixin,
            DeployableMixin,
            XlsExportableMixin,
            FormpackXLSFormUtilsMixin,
            models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONBField(default=dict)
    summary = JSONBField(default=dict)
    report_styles = JSONBField(default=dict)
    report_custom = JSONBField(default=dict)
    map_styles = LazyDefaultJSONBField(default=dict)
    map_custom = LazyDefaultJSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default=ASSET_TYPE_SURVEY)
    parent = models.ForeignKey('Asset', related_name='children',
                               null=True, blank=True, on_delete=models.CASCADE)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True,
                              on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = JSONBField(default=dict)

    # `_deployment_data` must **NOT** be touched directly by anything except
    # the `deployment` property provided by `DeployableMixin`.
    # ToDo Move the field to another table with one-to-one relationship
    _deployment_data = JSONBField(default=dict)

    # JSON with subset of fields to share
    # {
    #   'enable': True,
    #   'fields': []  # shares all when empty
    # }
    data_sharing = LazyDefaultJSONBField(default=dict)
    # JSON with source assets' information
    # {
    #   <source_uid>: {
    #       'fields': []  # includes all fields shared by source when empty
    #       'paired_data_uid': 'pdxxxxxxx'  # auto-generated read-only
    #       'filename: 'xxxxx.xml'
    #   },
    #   ...
    #   <source_uid>: {
    #       'fields': []
    #       'paired_data_uid': 'pdxxxxxxx'
    #       'filename: 'xxxxx.xml'
    #   }
    # }
    paired_data = LazyDefaultJSONBField(default=dict)

    objects = AssetManager()

    @property
    def kind(self):
        return 'asset'

    class Meta:

        # Example in Django documentation  represents `ordering` as a list
        # (even if it can be a list or a tuple). We enforce the type to `list`
        # because `rest_framework.filters.OrderingFilter` work with lists.
        # `AssetOrderingFilter` inherits from this class and it is used `
        # in `AssetViewSet to sort the result.
        # It avoids back and forth between types and/or coercing where
        # ordering is needed
        ordering = [
            '-date_modified',
        ]

        permissions = (
            # change_, add_, and delete_asset are provided automatically
            # by Django
            (PERM_VIEW_ASSET, _('Can view asset')),
            (PERM_DISCOVER_ASSET, _('Can discover asset in public lists')),
            (PERM_MANAGE_ASSET, _('Can manage all aspects of asset')),
            # Permissions for collected data, i.e. submissions
            (PERM_ADD_SUBMISSIONS, _('Can submit data to asset')),
            (PERM_VIEW_SUBMISSIONS, _('Can view submitted data for asset')),
            (PERM_PARTIAL_SUBMISSIONS, _('Can make partial actions on '
                                         'submitted data for asset '
                                         'for specific users')),
            (PERM_CHANGE_SUBMISSIONS, _('Can modify submitted data for asset')),
            (PERM_DELETE_SUBMISSIONS, _('Can delete submitted data for asset')),
            (PERM_VALIDATE_SUBMISSIONS, _("Can validate submitted data asset")),
            # TEMPORARY Issue #1161: A flag to indicate that permissions came
            # solely from `sync_kobocat_xforms` and not from any user
            # interaction with KPI
            (PERM_FROM_KC_ONLY, 'INTERNAL USE ONLY; DO NOT ASSIGN')
        )

        # Since Django 2.1, 4 permissions are added for each registered model:
        # - add
        # - change
        # - delete
        # - view
        # See https://docs.djangoproject.com/en/2.2/topics/auth/default/#default-permissions
        # for more detail.
        # `view_asset` clashes with newly built-in one.
        # The simplest way to fix this is to keep old behaviour
        default_permissions = ('add', 'change', 'delete')

    # Labels for each `asset_type` as they should be presented to users. Can be
    # strings or callables if special logic is needed. Callables receive the
    # codename of the permission for which a label is being created
    ASSET_TYPE_LABELS_FOR_PERMISSIONS = {
        ASSET_TYPE_SURVEY: (
            lambda p: _('project') if p == PERM_MANAGE_ASSET else _('form')
        ),
        ASSET_TYPE_TEMPLATE: _('template'),
        ASSET_TYPE_BLOCK: _('block'),
        ASSET_TYPE_QUESTION: _('question'),
        ASSET_TYPE_TEXT: _('text'),  # unused?
        ASSET_TYPE_EMPTY: _('empty'),  # unused?
        ASSET_TYPE_COLLECTION: _('collection'),
    }

    # Assignable permissions that are stored in the database.
    # The labels are templates used by `get_label_for_permission()`, which you
    # should call instead of accessing this dictionary directly
    ASSIGNABLE_PERMISSIONS_WITH_LABELS = {
        PERM_VIEW_ASSET: _('View ##asset_type_label##'),
        PERM_CHANGE_ASSET: _('Edit ##asset_type_label##'),
        PERM_DISCOVER_ASSET: _('Discover ##asset_type_label##'),
        PERM_MANAGE_ASSET: _('Manage ##asset_type_label##'),
        PERM_ADD_SUBMISSIONS: _('Add submissions'),
        PERM_VIEW_SUBMISSIONS: _('View submissions'),
        PERM_PARTIAL_SUBMISSIONS: {
            'default': _(
                'Act on submissions only from specific users'
            ),
            PERM_VIEW_SUBMISSIONS: _(
                'View submissions only from specific users'
            ),
            PERM_CHANGE_SUBMISSIONS: _(
                'Edit submissions only from specific users'
            ),
            PERM_DELETE_SUBMISSIONS: _(
                'Delete submissions only from specific users'
            ),
            PERM_VALIDATE_SUBMISSIONS: _(
                'Validate submissions only from specific users'
            ),
        },
        PERM_CHANGE_SUBMISSIONS: _('Edit submissions'),
        PERM_DELETE_SUBMISSIONS: _('Delete submissions'),
        PERM_VALIDATE_SUBMISSIONS: _('Validate submissions'),
    }
    ASSIGNABLE_PERMISSIONS = tuple(ASSIGNABLE_PERMISSIONS_WITH_LABELS.keys())
    # Depending on our `asset_type`, only some permissions might be applicable
    ASSIGNABLE_PERMISSIONS_BY_TYPE = {
        ASSET_TYPE_SURVEY: tuple(
            (p for p in ASSIGNABLE_PERMISSIONS if p != PERM_DISCOVER_ASSET)
        ),
        ASSET_TYPE_TEMPLATE: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_BLOCK: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_QUESTION: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_TEXT: (),  # unused?
        ASSET_TYPE_EMPTY: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_COLLECTION: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_DISCOVER_ASSET,
            PERM_MANAGE_ASSET,
        ),
    }

    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = (
        PERM_DELETE_ASSET,
    )
    # Only certain permissions can be inherited
    HERITABLE_PERMISSIONS = {
        # parent permission: child permission
        PERM_VIEW_ASSET: PERM_VIEW_ASSET,
        PERM_CHANGE_ASSET: PERM_CHANGE_ASSET
    }
    # Granting some permissions implies also granting other permissions
    IMPLIED_PERMISSIONS = {
        # Format: explicit: (implied, implied, ...)
        PERM_CHANGE_ASSET: (PERM_VIEW_ASSET,),
        PERM_DISCOVER_ASSET: (PERM_VIEW_ASSET,),
        PERM_MANAGE_ASSET: tuple(
            (
                p
                for p in ASSIGNABLE_PERMISSIONS
                if p not in (PERM_MANAGE_ASSET, PERM_PARTIAL_SUBMISSIONS)
            )
        ),
        PERM_ADD_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_VIEW_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_PARTIAL_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_CHANGE_SUBMISSIONS: (
            PERM_VIEW_SUBMISSIONS,
            PERM_ADD_SUBMISSIONS,
        ),
        PERM_DELETE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
    }

    CONTRADICTORY_PERMISSIONS = {
        PERM_PARTIAL_SUBMISSIONS: (
            PERM_VIEW_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS,
            PERM_DELETE_SUBMISSIONS,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_MANAGE_ASSET,
        ),
        PERM_VIEW_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_CHANGE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_DELETE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
    }

    # Some permissions must be copied to KC
    KC_PERMISSIONS_MAP = {  # keys are KPI's codenames, values are KC's
        PERM_CHANGE_SUBMISSIONS: 'change_xform',  # "Can Edit" in KC UI
        PERM_VIEW_SUBMISSIONS: 'view_xform',  # "Can View" in KC UI
        PERM_ADD_SUBMISSIONS: 'report_xform',  # "Can submit to" in KC UI
        PERM_DELETE_SUBMISSIONS: 'delete_data_xform',  # "Can Delete Data" in KC UI
        PERM_VALIDATE_SUBMISSIONS: 'validate_xform',  # "Can Validate" in KC UI
    }
    KC_CONTENT_TYPE_KWARGS = {'app_label': 'logger', 'model': 'xform'}
    # KC records anonymous access as flags on the `XForm`
    KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS = {
        PERM_VIEW_SUBMISSIONS: {'shared': True, 'shared_data': True}
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # The two fields below are needed to keep a trace of the object state
        # before any alteration. See `__self.__copy_hidden_fields()` for details
        # They must be set with an invalid value for their counterparts to
        # be the comparison is accurate.
        self.__parent_id_copy = -1
        self.__deployment_data_copy = None
        self.__copy_hidden_fields()

    def __str__(self):
        return '{} ({})'.format(self.name, self.uid)

    def adjust_content_on_save(self):
        """
        This is called on save by default if content exists.
        Can be disabled / skipped by calling with parameter:
        asset.save(adjust_content=False)
        """
        self._standardize(self.content)

        self._make_default_translation_first(self.content)
        self._strip_empty_rows(self.content)
        self._assign_kuids(self.content)
        self._autoname(self.content)
        self._unlink_list_items(self.content)
        self._remove_empty_expressions(self.content)

        settings = self.content['settings']
        _title = settings.pop('form_title', None)
        id_string = settings.get('id_string')
        filename = self.summary.pop('filename', None)
        if filename:
            # if we have filename available, set the id_string
            # and/or form_title from the filename.
            if not id_string:
                id_string = sluggify_label(filename)
                settings['id_string'] = id_string
            if not _title:
                _title = filename
        if self.asset_type not in [ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE]:
            # instead of deleting the settings, simply clear them out
            self.content['settings'] = {}
            strip_kobo_locking_profile(self.content)

        if _title is not None:
            self.name = _title

    def clone(self, version_uid=None):
        # not currently used, but this is how "to_clone_dict" should work
        return Asset.objects.create(**self.to_clone_dict(version=version_uid))

    def create_version(self) -> [AssetVersion, None]:
        """
        Create a version of current asset.
        Asset has to belong to `ASSET_TYPE_WITH_CONTENT` otherwise no version
        is created and `None` is returned.
        """
        if self.asset_type not in ASSET_TYPES_WITH_CONTENT:
            return

        return self.asset_versions.create(
            name=self.name,
            version_content=self.content,
            _deployment_data=self._deployment_data,
            # Any new version starts out as not-deployed,
            # even if the asset itself is already deployed.
            # Note: `asset_version.deployed` is set in the
            # serializer `DeploymentSerializer`
            deployed=False,
        )

    @property
    def deployed_versions(self):
        return self.asset_versions.filter(deployed=True).order_by(
            '-date_modified')

    @property
    def discoverable_when_public(self):
        # This property is only needed when `self` is a collection.
        # We want to make a distinction between a collection which is not
        # discoverable and an asset which is not a collection
        # (which implies cannot be discoverable)
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return None

        return self.permissions.filter(permission__codename=PERM_DISCOVER_ASSET,
                                       user_id=settings.ANONYMOUS_USER_ID).exists()

    def get_filters_for_partial_perm(
        self, user_id: int, perm: str = PERM_VIEW_SUBMISSIONS
    ) -> Union[list, None]:
        """
        Returns the list of filters for a specific permission `perm`
        and this specific asset.

        `perm` can only one of the submission permissions.
        """
        if (
            not perm.endswith(SUFFIX_SUBMISSIONS_PERMS)
            or perm == PERM_PARTIAL_SUBMISSIONS
        ):
            raise BadPermissionsException(_('Only partial permissions for '
                                            'submissions are supported'))

        perms = self.get_partial_perms(user_id, with_filters=True)
        if perms:
            try:
                return perms[perm]
            except KeyError:
                # User has some partial permissions but not the good one.
                # Return a false condition to avoid showing any results.
                return [{'_id': -1}]

        return None

    def get_label_for_permission(
        self, permission_or_codename: Union[Permission, str]
    ) -> str:
        """
        Get the correct label for a permission (object or codename) based on
        the type of this asset
        """
        try:
            codename = permission_or_codename.codename
            permission = permission_or_codename
        except AttributeError:
            codename = permission_or_codename
            permission = None

        try:
            label = self.ASSIGNABLE_PERMISSIONS_WITH_LABELS[codename]
        except KeyError:
            if permission:
                label = permission.name
            else:
                cached_code_names = get_cached_code_names()
                label = cached_code_names[codename]['name']

        asset_type_label = self.ASSET_TYPE_LABELS_FOR_PERMISSIONS[
            self.asset_type
        ]
        try:
            # Some labels may be callables
            asset_type_label = asset_type_label(codename)
        except TypeError:
            # Others are just strings
            pass

        # For partial permissions, label is a dict.
        # There is no replacements to do in the nested labels, but these lines
        # are there to support in case we need it one day
        if isinstance(label, dict):
            labels = copy.deepcopy(label)
            for key_ in labels.keys():
                labels[key_] = labels[key_].replace(
                    '##asset_type_label##',
                    # Raises TypeError if not coerced explicitly due to
                    # ugettext_lazy()
                    str(asset_type_label)
                )
            return labels
        else:
            return label.replace(
                '##asset_type_label##',
                # Raises TypeError if not coerced explicitly due to
                # ugettext_lazy()
                str(asset_type_label)
            )

    def get_partial_perms(
        self, user_id: int, with_filters: bool = False
    ) -> Union[list, dict, None]:
        """
        Returns the list of permissions the user is restricted to,
        for this specific asset.
        If `with_filters` is `True`, it returns a dict of permissions (as keys)
        and the filters (as values) to apply on query to narrow down
        the results.

        For example:
        `get_partial_perms(user1_obj.id)` would return
        ```
        ['view_submissions',]
        ```

        `get_partial_perms(user1_obj.id, with_filters=True)` would return
        ```
        {
            'view_submissions: [
                {'_submitted_by': {'$in': ['user1', 'user2']}},
                {'_submitted_by': 'user3'}
            ],
        }
        ```

        If user doesn't have any partial permissions, it returns `None`.
        """

        perms = self.asset_partial_permissions.filter(user_id=user_id)\
            .values_list("permissions", flat=True).first()

        if perms:
            if with_filters:
                return perms
            else:
                return list(perms)

        return None

    @property
    def has_active_hooks(self):
        """
        Returns if asset has active hooks.
        Useful to update `kc.XForm.has_kpi_hooks` field.
        :return: {boolean}
        """
        return self.hooks.filter(active=True).exists()

    def has_subscribed_user(self, user_id):
        # This property is only needed when `self` is a collection.
        # We want to make a distinction between a collection which does not have
        # the subscribed user and an asset which is not a collection
        # (which implies cannot have subscriptions)
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return None

        # ToDo: See if using a loop can reduce the number of SQL queries.
        return self.userassetsubscription_set.filter(user_id=user_id).exists()

    @property
    def latest_deployed_version(self):
        return self.deployed_versions.first()

    @property
    def latest_version(self):
        versions = None
        try:
            versions = self.prefetched_latest_versions
        except AttributeError:
            versions = self.asset_versions.order_by('-date_modified')
        try:
            return versions[0]
        except IndexError:
            return None

    @staticmethod
    def optimize_queryset_for_list(queryset):
        """ Used by serializers to improve performance when listing assets """
        queryset = queryset.defer(
            # Avoid pulling these from the database because they are often huge
            # and we don't need them for list views.
            'content', 'report_styles'
        ).select_related(
            # We only need `username`, but `select_related('owner__username')`
            # actually pulled in the entire `auth_user` table under Django 1.8.
            # In Django 1.9+, "select_related() prohibits non-relational fields
            # for nested relations."
            'owner',
        ).prefetch_related(
            'permissions__permission',
            'permissions__user',
            # `Prefetch(..., to_attr='prefetched_list')` stores the prefetched
            # related objects in a list (`prefetched_list`) that we can use in
            # other methods to avoid additional queries; see:
            # https://docs.djangoproject.com/en/1.8/ref/models/querysets/#prefetch-objects
            Prefetch('tags', to_attr='prefetched_tags'),
            Prefetch(
                'asset_versions',
                queryset=AssetVersion.objects.order_by(
                    '-date_modified'
                ).only('uid', 'asset', 'date_modified', 'deployed'),
                to_attr='prefetched_latest_versions',
            ),
        )
        return queryset

    def refresh_from_db(self, using=None, fields=None):
        super().refresh_from_db(using=using, fields=fields)
        # Refresh hidden fields too
        self.__copy_hidden_fields(fields)

    def rename_translation(self, _from, _to):
        if not self._has_translations(self.content, 2):
            raise ValueError('no translations available')
        self._rename_translation(self.content, _from, _to)

    # todo: test and implement this method
    # todo 2019-04-25: Still needed, `revert_to_version` does the same?
    # def restore_version(self, uid):
    #     _version_to_restore = self.asset_versions.get(uid=uid)
    #     self.content = _version_to_restore.version_content
    #     self.name = _version_to_restore.name

    def revert_to_version(self, version_uid):
        av = self.asset_versions.get(uid=version_uid)
        self.content = av.version_content
        self.save()

    def save(
        self,
        force_insert=False,
        force_update=False,
        update_fields=None,
        adjust_content=True,
        create_version=True,
        update_parent_languages=True,
        *args,
        **kwargs
    ):
        is_new = self.pk is None

        if self.asset_type not in ASSET_TYPES_WITH_CONTENT:
            # so long as all of the operations in this overridden `save()`
            # method pertain to content, bail out if it's impossible for this
            # asset to have content in the first place
            super().save(
                force_insert=force_insert,
                force_update=force_update,
                update_fields=update_fields,
                *args,
                **kwargs
            )
            return

        if self.content is None:
            self.content = {}

        # in certain circumstances, we don't want content to
        # be altered on save. (e.g. on asset.deploy())
        if adjust_content:
            self.adjust_content_on_save()

        # populate summary
        self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in [ASSET_TYPE_QUESTION, ASSET_TYPE_BLOCK]:
            try:
                row_count = int(self.summary.get('row_count'))
            except TypeError:
                pass
            else:
                if row_count == 1:
                    self.asset_type = ASSET_TYPE_QUESTION
                elif row_count > 1:
                    self.asset_type = ASSET_TYPE_BLOCK

        self._populate_report_styles()

        # Ensure `_deployment_data` is not saved directly
        try:
            stored_data_key = self._deployment_data['_stored_data_key']
        except KeyError:
            if self._deployment_data != self.__deployment_data_copy:
                raise DeploymentDataException
        else:
            if stored_data_key != self.deployment.stored_data_key:
                raise DeploymentDataException
            else:
                self._deployment_data.pop('_stored_data_key', None)
                self.__copy_hidden_fields()

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            update_fields=update_fields,
            *args,
            **kwargs
        )

        # Update languages for parent and previous parent.
        # e.g. if a survey has been moved from one collection to another,
        # we want both collections to be updated.
        if self.parent is not None and update_parent_languages:
            if (
                self.parent_id != self.__parent_id_copy
                and self.__parent_id_copy is not None
            ):
                try:
                    previous_parent = Asset.objects.get(
                        pk=self.__parent_id_copy)
                    previous_parent.update_languages()
                    self.__parent_id_copy = self.parent_id
                except Asset.DoesNotExist:
                    pass

            # If object is new, we can add its languages to its parent without
            # worrying about removing its old values. It avoids an extra query.
            if is_new:
                self.parent.update_languages([self])
            else:
                # Otherwise, because we cannot know which languages are from
                # this object, update will be performed with all parent's
                # children.
                self.parent.update_languages()

        if self.has_deployment:
            self.deployment.sync_media_files(AssetFile.PAIRED_DATA)

        if create_version:
            self.create_version()

    @property
    def snapshot(self):
        return self._snapshot(regenerate=False)

    @property
    def tag_string(self):
        try:
            tag_list = self.prefetched_tags
        except AttributeError:
            tag_names = self.tags.values_list('name', flat=True)
        else:
            tag_names = [t.name for t in tag_list]
        return ','.join(tag_names)

    @tag_string.setter
    def tag_string(self, value):
        intended_tags = value.split(',')
        self.tags.set(*intended_tags)

    def to_clone_dict(
            self,
            version: Union[str, AssetVersion] = None
    ) -> dict:
        """
        Returns a dictionary of the asset based on its version.

        :param version: Optional. It can be an object or its unique id
        :return dict
        """
        if not isinstance(version, AssetVersion):
            if version:
                version = self.asset_versions.get(uid=version)
            else:
                version = self.asset_versions.first()
                if not version:
                    version = self.create_version()

        return {
            'name': version.name,
            'content': version.version_content,
            'asset_type': self.asset_type,
            'tag_string': self.tag_string,
        }

    def to_ss_structure(self):
        return flatten_content(self.content, in_place=False)

    def update_languages(self, children=None):
        """
        Updates object's languages by aggregating all its children's languages

        Args:
            children (list<Asset>): Optional. When specified, `children`'s languages
            are merged with `self`'s languages. Otherwise, when it's `None`,
            DB is fetched to build the list according to `self.children`

        """
        # If object is not a collection, it should not have any children.
        # No need to go further.
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return

        obj_languages = self.summary.get('languages', [])
        languages = set()

        if children:
            languages = set(obj_languages)
            children_languages = [child.summary.get('languages')
                                  for child in children
                                  if child.summary.get('languages')]
        else:
            children_languages = list(self.children
                                      .values_list('summary__languages',
                                                   flat=True)
                                      .exclude(Q(summary__languages=[]) |
                                               Q(summary__languages=[None]))
                                      .order_by())

        if children_languages:
            # Flatten `children_languages` to 1-dimension list.
            languages.update(reduce(add, children_languages))

        languages.discard(None)
        # Object of type set is not JSON serializable
        languages = list(languages)

        # If languages are still the same, no needs to update the object
        if sorted(obj_languages) == sorted(languages):
            return

        self.summary['languages'] = languages
        self.save(update_fields=['summary'])

    @property
    def version__content_hash(self):
        # Avoid reading the property `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.content_hash

    @property
    def version_id(self):
        # Avoid reading the property `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.uid

    @property
    def version_number_and_date(self) -> str:
        # Returns the count of all deployed versions (plus one for the current
        # version if it is not deployed) and the date the asset was last
        # modified
        count = self.deployed_versions.count()

        if not self.latest_version.deployed:
            count = count + 1

        return f'{count} {self.date_modified:(%Y-%m-%d %H:%M:%S)}'

    def _populate_report_styles(self):
        default = self.report_styles.get(DEFAULT_REPORTS_KEY, {})
        specifieds = self.report_styles.get(SPECIFIC_REPORTS_KEY, {})
        kuids_to_variable_names = self.report_styles.get('kuid_names', {})
        for (index, row) in enumerate(self.content.get('survey', [])):
            if '$kuid' not in row:
                if 'name' in row:
                    row['$kuid'] = json_hash([self.uid, row['name']])
                else:
                    row['$kuid'] = json_hash([self.uid, index, row])
            _identifier = row.get('name', row['$kuid'])
            kuids_to_variable_names[_identifier] = row['$kuid']
            if _identifier not in specifieds:
                specifieds[_identifier] = {}
        self.report_styles = {
            DEFAULT_REPORTS_KEY: default,
            SPECIFIC_REPORTS_KEY: specifieds,
            'kuid_names': kuids_to_variable_names,
        }

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    @transaction.atomic
    def _snapshot(self, regenerate=True):
        asset_version = self.latest_version

        try:
            snapshot = AssetSnapshot.objects.get(asset=self,
                                                 asset_version=asset_version)
            if regenerate:
                snapshot.delete()
                snapshot = False
        except AssetSnapshot.MultipleObjectsReturned:
            # how did multiple snapshots get here?
            snaps = AssetSnapshot.objects.filter(asset=self,
                                                 asset_version=asset_version)
            snaps.delete()
            snapshot = False
        except AssetSnapshot.DoesNotExist:
            snapshot = False

        if not snapshot:
            if self.name != '':
                form_title = self.name
            else:
                _settings = self.content.get('settings', {})
                form_title = _settings.get('id_string', 'Untitled')

            self._append(self.content, settings={
                'form_title': form_title,
            })
            snapshot = AssetSnapshot.objects.create(asset=self,
                                                    asset_version=asset_version,
                                                    source=self.content)
        return snapshot

    def _update_partial_permissions(
        self,
        user: 'auth.User',
        perm: str,
        remove: bool = False,
        partial_perms: Optional[dict] = None,
    ):
        """
        Stores, updates, and removes permissions that apply only to a subset of
        submissions in a project (also called row-level permissions or partial
        permissions).

        If `perm = PERM_PARTIAL_SUBMISSIONS`, it must be accompanied by
        `partial_perms`, which is a dictionary of permissions mapped to MongoDB
        filters. Each key of that dictionary is a permission string (codename),
        and each value is a list of MongoDB queries that specify which
        submissions the permission affects. A submission is affected if it
        matches *ANY* of the queries in the list.

        For example, to allow `user` to edit submissions made by 'alice' or
        'bob', and to allow `user` also to validate only submissions made by
        'bob', the following `partial_perms` could be used:
        ```
        {
            'change_submissions': [{
                '_submitted_by': {
                    '$in': [
                        'alice',
                        'bob'
                    ]
                }
            }],
            'validate_submissions': [{
                '_submitted_by': 'bob'
            }],
        }
        ```

        If `perm` is something other than `PERM_PARTIAL_SUBMISSIONS`, and that
        permission contradicts `PERM_PARTIAL_SUBMISSIONS`, *all* partial
        permission assignments for `user` on this asset are removed from the
        database. If the permission does not conflict, no action is taken.

        `remove = True` deletes all partial permissions assignments for `user`
        on this asset.
        """

        def clean_up_table():
            # Because of the unique constraint, there should be only
            # one record that matches this query.
            # We don't look for record existence to avoid extra query.
            self.asset_partial_permissions.filter(user_id=user.pk).delete()

        if perm == PERM_PARTIAL_SUBMISSIONS:

            if remove:
                clean_up_table()
                return

            if user.pk == self.owner.pk:
                raise BadPermissionsException(
                    _("Can not assign '{}' permission to owner".format(perm)))

            if not partial_perms:
                raise BadPermissionsException(
                    _("Can not assign '{}' permission. "
                      "Partial permissions are missing.".format(perm)))

            new_partial_perms = defaultdict(list)
            in_op = MongoHelper.IN_OPERATOR

            for partial_perm, filters in partial_perms.items():

                if partial_perm not in new_partial_perms:
                    new_partial_perms[partial_perm] = filters

                implied_perms = [
                    implied_perm
                    for implied_perm in self.get_implied_perms(partial_perm)
                    if implied_perm.endswith(SUFFIX_SUBMISSIONS_PERMS)
                ]

                for implied_perm in implied_perms:

                    if (
                        implied_perm not in new_partial_perms
                        and implied_perm in partial_perms
                    ):
                        new_partial_perms[implied_perm] = partial_perms[implied_perm]

                    new_partial_perm = new_partial_perms[implied_perm]
                    # Trivial case, i.e.: permissions are built with front end.
                    # All permissions have only one filter and the same filter
                    # Example:
                    # ```
                    # partial_perms = {
                    #   'view_submissions' : [
                    #       {'_submitted_by': {'$in': ['johndoe']}
                    #   ],
                    #   'delete_submissions':  [
                    #       {'_submitted_by': {'$in': ['quidam']}
                    #   ]
                    # }
                    # ```
                    # should give
                    # ```
                    # new_partial_perms = {
                    #   'view_submissions' : [
                    #       {'_submitted_by': {'$in': ['johndoe', 'quidam']}
                    #   ],
                    #   'delete_submissions':  [
                    #       {'_submitted_by': {'$in': ['quidam']}
                    #   ]
                    # }
                    if (
                        len(filters) == 1
                        and len(new_partial_perm) == 1
                        and isinstance(new_partial_perm, list)
                    ):
                        current_filters = new_partial_perms[implied_perm][0]
                        filter_ = filters[0]
                        # Front end only supports `_submitted_by`, but if users
                        # use the API, it could be something else.
                        filter_key = list(filter_)[0]
                        try:
                            new_value = filter_[filter_key][in_op]
                            current_values = current_filters[filter_key][in_op]
                        except (KeyError, TypeError):
                            pass
                        else:
                            new_partial_perm[0][filter_key][in_op] = list(
                                set(current_values + new_value)
                            )
                            continue

                    # As said earlier, front end only supports `'_submitted_by'`
                    # filter, but many different and more complex filters could
                    # be used.
                    # If we reach these lines, it means conditions cannot be
                    # merged, so we concatenate then with an `OR` operator.
                    # Example:
                    # ```
                    # partial_perms = {
                    #   'view_submissions' : [{'_submitted_by': 'johndoe'}],
                    #   'delete_submissions':  [
                    #       {'_submission_date': {'$lte': '2021-01-01'},
                    #       {'_submission_date': {'$gte': '2020-01-01'}
                    #   ]
                    # }
                    # ```
                    # should give
                    # ```
                    # new_partial_perms = {
                    #   'view_submissions' : [
                    #           [{'_submitted_by': 'johndoe'}],
                    #           [
                    #               {'_submission_date': {'$lte': '2021-01-01'},
                    #               {'_submission_date': {'$gte': '2020-01-01'}
                    #           ]
                    #   },
                    #   'delete_submissions':  [
                    #       {'_submission_date': {'$lte': '2021-01-01'},
                    #       {'_submission_date': {'$gte': '2020-01-01'}
                    #   ]
                    # }

                    # To avoid more complexity (and different syntax than
                    # trivial case), we delegate to MongoHelper the task to join
                    # lists with the `$or` operator.
                    try:
                        new_partial_perm = new_partial_perms[implied_perm][0]
                    except IndexError:
                        # If we get an IndexError, implied permission does not
                        # belong to current assignment. Let's copy the filters
                        #
                        new_partial_perms[implied_perm] = filters
                    else:
                        if not isinstance(new_partial_perm, list):
                            new_partial_perms[implied_perm] = [
                                filters,
                                new_partial_perms[implied_perm]
                            ]
                        else:
                            new_partial_perms[implied_perm].append(filters)

            AssetUserPartialPermission.objects.update_or_create(
                asset_id=self.pk,
                user_id=user.pk,
                defaults={'permissions': new_partial_perms})

            # There are no real partial permissions for 'add_submissions' but
            # 'change_submissions' implies it. So if 'add_submissions' is in the
            # partial permissions list, it must be assigned to the user to the
            # user as well to let them perform edit actions on their subset of
            # data. Otherwise, KC will reject some actions.
            if PERM_ADD_SUBMISSIONS in new_partial_perms:
                self.assign_perm(
                    user_obj=user, perm=PERM_ADD_SUBMISSIONS, defer_recalc=True
                )

        elif perm in self.CONTRADICTORY_PERMISSIONS.get(PERM_PARTIAL_SUBMISSIONS):
            clean_up_table()

    def __copy_hidden_fields(self, fields: Optional[list] = None):
        """
        Save a copy of `parent_id` and `_deployment_data` for these purposes
        `save()` respectively.

        - `self.__parent_id_copy` is used to detect whether asset is linked a
           different parent
        - `self.__deployment_data_copy` is used to detect whether
          `_deployment_data` has been altered directly
        """

        # When fields are deferred, Django instantiates another copy
        # of the current Asset object to retrieve the value of the
        # requested field. Because we need to get a copy at the very
        # first beginning of the life of the object, this method is
        # called in the object constructor. Thus, trying to copy
        # deferred fields would create an infinite loop.
        # If `fields` is provided, fields are no longer deferred and should be
        # copied right away.
        if (
            fields is None and 'parent_id' not in self.get_deferred_fields()
            or fields and 'parent_id' in fields
        ):
            self.__parent_id_copy = self.parent_id
        if (
            fields is None and '_deployment_data' not in self.get_deferred_fields()
            or fields and '_deployment_data' in fields
        ):
            self.__deployment_data_copy = copy.deepcopy(
                self._deployment_data)


class UserAssetSubscription(models.Model):
    """ Record a user's subscription to a publicly-discoverable collection,
    i.e. one where the anonymous user has been granted `discover_asset` """
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='b')

    class Meta:
        unique_together = ('asset', 'user')
