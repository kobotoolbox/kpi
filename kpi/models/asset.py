import copy
import re
from functools import reduce
from operator import add
from typing import Optional, Union

import jsonschema
from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.postgres.indexes import BTreeIndex, GinIndex
from django.db import models, transaction
from django.db.models import F, Prefetch, Q
from django.utils.translation import gettext_lazy as t
from django_request_cache import cache_for_request
from formpack.utils.flatten_content import flatten_content
from formpack.utils.json_hash import json_hash
from formpack.utils.kobo_locking import strip_kobo_locking_profile
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager

from kobo.apps.reports.constants import DEFAULT_REPORTS_KEY, SPECIFIC_REPORTS_KEY
from kobo.apps.subsequences.advanced_features_params_schema import (
    ADVANCED_FEATURES_PARAMS_SCHEMA,
)
from kobo.apps.subsequences.utils import (
    advanced_feature_instances,
    advanced_submission_jsonschema,
)
from kobo.apps.subsequences.utils.deprecation import (
    get_sanitized_advanced_features,
    get_sanitized_dict_keys,
    get_sanitized_known_columns,
    qpath_to_xpath,
)
from kobo.apps.subsequences.utils.parse_known_cols import parse_known_cols
from kpi.constants import (
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_QUESTION,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    ASSET_TYPE_TEXT,
    ASSET_TYPES,
    ASSET_TYPES_WITH_CONTENT,
    ATTACHMENT_QUESTION_TYPES,
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
    AssetAdjustContentError,
    BadPermissionsException,
    DeploymentDataException,
)
from kpi.fields import KpiUidField, LazyDefaultJSONBField
from kpi.mixins import (
    FormpackXLSFormUtilsMixin,
    ObjectPermissionMixin,
    StandardizeSearchableFieldMixin,
    XlsExportableMixin,
)
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.models.asset_file import AssetFile
from kpi.models.asset_snapshot import AssetSnapshot
from kpi.models.asset_user_partial_permission import AssetUserPartialPermission
from kpi.models.asset_version import AssetVersion
from kpi.utils.asset_content_analyzer import AssetContentAnalyzer
from kpi.utils.object_permission import (
    get_cached_code_names,
    post_assign_partial_perm,
    post_remove_partial_perms,
)
from kpi.utils.sluggify import sluggify_label

SEARCH_FIELD_SCHEMA = {
    'type': 'object',
    'properties': {
        'owner_username': {'type': 'string'},
        'organization_name': {'type': 'string'},
    },
    'required': ['owner_username', 'organization_name'],
}


class AssetDeploymentStatus(models.TextChoices):

    ARCHIVED = 'archived', 'Archived'
    DEPLOYED = 'deployed', 'Deployed'
    DRAFT = 'draft', 'Draft'


class AssetSetting:
    """
    Utility class for standardizing settings

    Used with calls to standardize_searchable_field

    Parameters:
      setting_type [type]: can be str, dict, or list
      default_val [object|Callable]: can be either a value or a callable on an asset
      force_default [boolean]: if true, always use the default value
    """
    def __init__(self, setting_type, default_val=None, force_default=False):
        standard_defaults = {
            list: [],
            dict: {},
            str: '',
        }
        self.setting_type = setting_type
        self.default_val = (
            default_val if default_val else standard_defaults[setting_type]
        )
        self.force_default = force_default


# TODO: Would prefer this to be a mixin that didn't derive from `Manager`.
class AssetWithoutPendingDeletedManager(models.Manager):
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
        Filter for deployed assets (i.e. assets without a null value for `date_deployed`)
        """
        return self.exclude(date_deployed__isnull=True)

    def filter_by_tag_name(self, tag_name):
        return self.filter(tags__name=tag_name)

    def get_queryset(self):
        return super().get_queryset().exclude(pending_delete=True)


class AssetAllManager(AssetWithoutPendingDeletedManager):

    def get_queryset(self):
        return super(AssetWithoutPendingDeletedManager, self).get_queryset()


class KpiTaggableManager(_TaggableManager):
    @require_instance_manager
    def add(self, *tags, **kwargs):
        """ A wrapper that replaces spaces in tag names with dashes and also
        strips leading and trailng whitespace. Behavior should match the
        cleanupTags function in jsapp/js/utils.ts. """
        tags_out = []
        for tag in tags:
            # Modify strings only; the superclass' add() method will then
            # create Tags or use existing ones as appropriate.  We do not fix
            # existing Tag objects, which could also be passed into this
            # method, because a fixed name could collide with the name of
            # another Tag object already in the database.
            if isinstance(tag, str):
                tag = tag.strip().replace(' ', '-')
            tags_out.append(tag)
        super().add(*tags_out, **kwargs)


class Asset(
    ObjectPermissionMixin,
    DeployableMixin,
    XlsExportableMixin,
    FormpackXLSFormUtilsMixin,
    StandardizeSearchableFieldMixin,
    AbstractTimeStampedModel,
):
    name = models.CharField(max_length=255, blank=True, default='')
    date_deployed = models.DateTimeField(null=True)
    content = models.JSONField(default=dict)
    summary = models.JSONField(default=dict)
    report_styles = models.JSONField(default=dict)
    report_custom = models.JSONField(default=dict)
    map_styles = LazyDefaultJSONBField(default=dict)
    map_custom = LazyDefaultJSONBField(default=dict)
    advanced_features = LazyDefaultJSONBField(default=dict)
    known_cols = LazyDefaultJSONBField(default=list)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default=ASSET_TYPE_SURVEY, db_index=True
    )
    parent = models.ForeignKey('Asset', related_name='children',
                               null=True, blank=True, on_delete=models.CASCADE)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='assets', null=True,
                              on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = models.JSONField(default=dict)

    # `_deployment_data` must **NOT** be touched directly by anything except
    # the `deployment` property provided by `DeployableMixin`.
    # ToDo Move the field to another table with one-to-one relationship
    _deployment_data = models.JSONField(default=dict)

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
    pending_delete = models.BooleanField(default=False)
    # `_deployment_status` is calculated field, therefore should **NOT** be
    # set directly.
    _deployment_status = models.CharField(
        max_length=8,
        choices=AssetDeploymentStatus.choices,
        null=True,
        blank=True,
        db_index=True
    )
    created_by = models.CharField(max_length=150, null=True, blank=True, db_index=True)
    last_modified_by = models.CharField(max_length=150, null=True, blank=True, db_index=True)
    search_field = models.JSONField(default=dict)

    objects = AssetWithoutPendingDeletedManager()
    all_objects = AssetAllManager()

    @property
    def kind(self):
        return 'asset'

    class Meta:

        indexes = [
            GinIndex(
                F('settings__country_codes'), name='settings__country_codes_idx'
            ),
            BTreeIndex(
                F('_deployment_data__formid'), name='deployment_data__formid_idx'
            ),
        ]

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
            (PERM_VIEW_ASSET, t('Can view asset')),
            (PERM_DISCOVER_ASSET, t('Can discover asset in public lists')),
            (PERM_MANAGE_ASSET, t('Can manage all aspects of asset')),
            # Permissions for collected data, i.e. submissions
            (PERM_ADD_SUBMISSIONS, t('Can submit data to asset')),
            (PERM_VIEW_SUBMISSIONS, t('Can view submitted data for asset')),
            (PERM_PARTIAL_SUBMISSIONS, t('Can make partial actions on '
                                         'submitted data for asset '
                                         'for specific users')),
            (PERM_CHANGE_SUBMISSIONS, t('Can modify submitted data for asset')),
            (PERM_DELETE_SUBMISSIONS, t('Can delete submitted data for asset')),
            (PERM_VALIDATE_SUBMISSIONS, t('Can validate submitted data asset')),
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
            lambda p: t('project') if p == PERM_MANAGE_ASSET else t('form')
        ),
        ASSET_TYPE_TEMPLATE: t('template'),
        ASSET_TYPE_BLOCK: t('block'),
        ASSET_TYPE_QUESTION: t('question'),
        ASSET_TYPE_TEXT: t('text'),  # unused?
        ASSET_TYPE_EMPTY: t('empty'),  # unused?
        ASSET_TYPE_COLLECTION: t('collection'),
    }

    # Assignable permissions that are stored in the database.
    # The labels are templates used by `get_label_for_permission()`, which you
    # should call instead of accessing this dictionary directly
    ASSIGNABLE_PERMISSIONS_WITH_LABELS = {
        PERM_VIEW_ASSET: t('View ##asset_type_label##'),
        PERM_CHANGE_ASSET: t('Edit ##asset_type_label##'),
        PERM_DISCOVER_ASSET: t('Discover ##asset_type_label##'),
        PERM_MANAGE_ASSET: t('Manage ##asset_type_label##'),
        PERM_ADD_SUBMISSIONS: t('Add submissions'),
        PERM_VIEW_SUBMISSIONS: t('View submissions'),
        PERM_PARTIAL_SUBMISSIONS: {
            'default': t(
                'Act on submissions only from specific users'
            ),
            PERM_VIEW_SUBMISSIONS: t(
                'View submissions only from specific users'
            ),
            PERM_CHANGE_SUBMISSIONS: t(
                'Edit submissions only from specific users'
            ),
            PERM_DELETE_SUBMISSIONS: t(
                'Delete submissions only from specific users'
            ),
            PERM_VALIDATE_SUBMISSIONS: t(
                'Validate submissions only from specific users'
            ),
        },
        PERM_CHANGE_SUBMISSIONS: t('Edit submissions'),
        PERM_DELETE_SUBMISSIONS: t('Delete submissions'),
        PERM_VALIDATE_SUBMISSIONS: t('Validate submissions'),
    }
    ASSIGNABLE_PERMISSIONS = tuple(ASSIGNABLE_PERMISSIONS_WITH_LABELS.keys())
    # Depending on our `asset_type`, only some permissions might be applicable
    ASSIGNABLE_PERMISSIONS_BY_TYPE = {
        ASSET_TYPE_SURVEY: tuple(
            p for p in ASSIGNABLE_PERMISSIONS if p != PERM_DISCOVER_ASSET
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
            p
            for p in ASSIGNABLE_PERMISSIONS
            if p not in (PERM_MANAGE_ASSET, PERM_PARTIAL_SUBMISSIONS)
        ),
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
        PERM_CHANGE_SUBMISSIONS: 'change_xform',  # "Can change XForm" in KC shell
        PERM_VIEW_SUBMISSIONS: 'view_xform',  # "Can view XForm" in KC shell
        PERM_ADD_SUBMISSIONS: 'report_xform',  # "Can make submissions to the form" in KC shell
        PERM_DELETE_SUBMISSIONS: 'delete_data_xform',  # "Can delete submissions" in KC shell
        PERM_VALIDATE_SUBMISSIONS: 'validate_xform',  # "Can validate submissions" in KC shell
        PERM_DELETE_ASSET: 'delete_xform',  # "Can delete XForm" in KC shell
    }
    KC_CONTENT_TYPE_KWARGS = {'app_label': 'logger', 'model': 'xform'}
    # KC records anonymous access as flags on the `XForm`
    KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS = {
        PERM_ADD_SUBMISSIONS: {'require_auth': False},
        PERM_VIEW_SUBMISSIONS: {'shared': True, 'shared_data': True}
    }

    STANDARDIZED_SETTINGS = {
        'country': AssetSetting(setting_type=list, default_val=[]),
        'sector': AssetSetting(setting_type=dict, default_val={}),
        'description': AssetSetting(setting_type=str, default_val=None),
        'organization': AssetSetting(setting_type=str, default_val=None),
        'country_codes': AssetSetting(
            setting_type=list,
            default_val=lambda asset: [c['value'] for c in asset.settings['country']],
            force_default=True,
        ),
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
        self._insert_xpath(self.content)
        self._unlink_list_items(self.content)
        self._remove_empty_expressions(self.content)
        self._remove_version(self.content)

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
            # Remove newlines and tabs (they are stripped in front end anyway)
            self.name = re.sub(r'[\n\t]+', '', _title)

    def analysis_form_json(self, omit_question_types=None):
        if omit_question_types is None:
            omit_question_types = []

        additional_fields = list(self._get_additional_fields())
        engines = dict(self._get_engines())
        output = {'engines': engines, 'additional_fields': additional_fields}
        try:
            qual_survey = self.advanced_features['qual']['qual_survey']
        except KeyError:
            return output
        for qual_question in qual_survey:
            # Surely some of this stuff is not actually used…
            # (added to match extend_col_deets() from
            # kobo/apps/subsequences/utils/parse_known_cols)
            #
            # See also injectSupplementalRowsIntoListOfRows() in
            # assetUtils.ts
            try:
                xpath = qual_question['xpath']
            except KeyError:
                xpath = qpath_to_xpath(qual_question['qpath'], self)

            field = dict(
                label=qual_question['labels']['_default'],
                name=f"{xpath}/{qual_question['uuid']}",
                dtpath=f"{xpath}/{qual_question['uuid']}",
                type=qual_question['type'],
                # could say '_default' or the language of the transcript,
                # but really that would be meaningless and misleading
                language='??',
                source=xpath,
                xpath=f"{xpath}/{qual_question['uuid']}",
                # seems not applicable given the transx questions describe
                # manual vs. auto here and which engine was used
                settings='??',
                path=[xpath, qual_question['uuid']],
            )
            if field['type'] in omit_question_types:
                continue
            try:
                field['choices'] = qual_question['choices']
            except KeyError:
                pass
            additional_fields.append(field)

        return output

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
    def deployment_status(self):
        """
        Public property for `_deployment_status`
        """
        return self._deployment_status

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

    def get_advanced_feature_instances(self):
        return advanced_feature_instances(self.content, self.advanced_features)

    def get_advanced_submission_schema(self, url=None, content=False):

        if len(self.advanced_features) == 0:
            NO_FEATURES_MSG = 'no advanced features activated for this form'
            return {'type': 'object', '$description': NO_FEATURES_MSG}

        if advanced_features := get_sanitized_advanced_features(self):
            self.advanced_features = advanced_features

        last_deployed_version = self.deployed_versions.first()
        if content:
            return advanced_submission_jsonschema(
                content, self.advanced_features, url=url
            )
        if last_deployed_version is None:
            NO_DEPLOYMENT_MSG = 'asset needs a deployment for this feature'
            return {'type': 'object', '$description': NO_DEPLOYMENT_MSG}
        content = last_deployed_version.version_content
        return advanced_submission_jsonschema(
            content, self.advanced_features, url=url
        )

    @cache_for_request
    def get_attachment_xpaths(self, deployed: bool = True) -> Optional[list]:
        version = (
            self.latest_deployed_version if deployed else self.latest_version
        )

        if version:
            content = version.to_formpack_schema()['content']
        else:
            content = self.content

        survey = content['survey']

        def _get_xpaths(survey_: dict) -> Optional[list]:
            """
            Returns an empty list if no questions that take attachments are
            present. Returns `None` if XPath are missing from the survey
            content
            """
            xpaths = []
            for question in survey_:
                if question['type'] not in ATTACHMENT_QUESTION_TYPES:
                    continue
                try:
                    xpath = question['$xpath']
                except KeyError:
                    return None
                xpaths.append(xpath)
            return xpaths

        if xpaths := _get_xpaths(survey):
            return xpaths

        self._insert_xpath(content)
        return _get_xpaths(survey)

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
            raise BadPermissionsException(t('Only partial permissions for '
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

        perms = (
            self.asset_partial_permissions.filter(user_id=user_id)
            .values_list('permissions', flat=True)
            .first()
        )

        if perms:
            if with_filters:
                return perms
            else:
                return list(perms)

        return None

    @property
    def has_advanced_features(self):
        if self.advanced_features is None:
            return False
        return len(self.advanced_features) > 0

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
    def latest_deployed_version_uid(self) -> Optional[str]:
        """
        Use this property to only load the `uid` field (and avoid big contents
        like `AssetVersion.content`)
        """
        version = self.deployed_versions.only('uid', 'asset_id').first()
        if not version:
            return None
        return version.uid

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

        if is_new:
            self._populate_search_field()

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

        update_content_field = update_fields and 'content' in update_fields

        # Raise an exception if we want to adjust asset content
        # (i.e. `adjust_content` is True) but we are trying to update only
        # certain fields and `content` is not part of them, or if we
        # specifically ask to not adjust asset content, but trying to
        # update only certain fields and `content` is one of them.
        if (
            (adjust_content and update_fields and 'content' not in update_fields)
            or
            (not adjust_content and update_content_field)
        ):
            raise AssetAdjustContentError

        # If `content` is part of the updated fields, `summary` and
        # `report_styles` must be too.
        if update_content_field:
            update_fields += ['summary', 'report_styles']
            # Avoid duplicates
            update_fields = list(set(update_fields))

        # `self.content` must be the second condition. We do not want to get
        # the value of `self.content` if first condition is false.
        # The main purpose of this is avoid to load `self.content` when it is
        # deferred (see `AssetNestedObjectViewsetMixin.asset`) and does not need
        # to be updated.
        if (
            (not update_fields or update_content_field)
            and self.content is None
        ):
            self.content = {}

        # in certain circumstances, we don't want content to
        # be altered on save. (e.g. on asset.deploy())
        if adjust_content:
            self.adjust_content_on_save()

        if (
            not update_fields
            or update_fields and 'advanced_features' in update_fields
        ):
            self.validate_advanced_features()

        # standardize settings (only when required)
        if (
            (not update_fields or update_fields and 'settings' in update_fields)
            and self.asset_type in [ASSET_TYPE_COLLECTION, ASSET_TYPE_SURVEY]
        ):
            # TODO: add a settings jsonschema to validate these
            for setting_name, setting in self.STANDARDIZED_SETTINGS.items():
                self.standardize_json_field(
                    'settings',
                    setting_name,
                    setting.setting_type,
                    (
                        setting.default_val(self)
                        if callable(setting.default_val)
                        else setting.default_val
                    ),
                    setting.force_default,
                )

        # populate summary (only when required)
        if not update_fields or update_fields and 'summary' in update_fields:
            self._populate_summary()
            self.standardize_json_field('summary', 'languages', list)

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

        # populate report styles (only when required)
        if (
            not update_fields
            or update_fields and 'report_styles' in update_fields
        ):
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

        self.set_deployment_status()

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

    def set_deployment_status(self):
        if self.asset_type != ASSET_TYPE_SURVEY:
            return

        if self.has_deployment:
            if self.deployment.active:
                self._deployment_status = AssetDeploymentStatus.DEPLOYED
            else:
                self._deployment_status = AssetDeploymentStatus.ARCHIVED
        else:
            self._deployment_status = AssetDeploymentStatus.DRAFT

    @property
    def tag_string(self):
        try:
            tag_list = self.prefetched_tags
        except AttributeError:
            tag_names = self.tags.values_list('name', flat=True)
        else:
            tag_names = [tag.name for tag in tag_list]
        return ','.join(tag_names)

    @tag_string.setter
    def tag_string(self, value):
        intended_tags = value.split(',')
        # Backwards incompatible: TaggableManager.set now takes a list of tags
        # (instead of varargs) so that its API matches Django’s RelatedManager.set.
        # Example:
        # previously: item.tags.set("red", "blue")
        # now: item.tags.set(["red", "blue"])
        self.tags.set(intended_tags)

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

    def update_search_field(self, **kwargs):
        for key, value in kwargs.items():
            self.search_field[key] = value
        jsonschema.validate(instance=self.search_field, schema=SEARCH_FIELD_SCHEMA)

    def update_submission_extra(self, content, user=None):
        submission_uuid = content.get('submission')
        # the view had better have handled this
        assert submission_uuid is not None

        # `select_for_update()` can only lock things that exist; make sure
        # a `SubmissionExtras` exists for this submission before proceeding
        self.submission_extras.get_or_create(submission_uuid=submission_uuid)

        with transaction.atomic():
            sub = (
                self.submission_extras.filter(submission_uuid=submission_uuid)
                .select_for_update()
                .first()
            )
            instances = self.get_advanced_feature_instances()
            if sub_extra_content := get_sanitized_dict_keys(sub.content, self):
                sub.content = sub_extra_content

            compiled_content = {**sub.content}

            for instance in instances:
                compiled_content = instance.compile_revised_record(
                    compiled_content, edits=content
                )
            sub.content = compiled_content
            sub.save()

        return sub

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
            children_languages = [
                child.summary.get('languages')
                for child in children
                if child.summary.get('languages')
            ]
        else:
            children_languages = list(
                self.children.values_list('summary__languages', flat=True)
                .exclude(Q(summary__languages=[]) | Q(summary__languages=[None]))
                .order_by()
            )

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

    def validate_advanced_features(self):
        if self.advanced_features is None:
            self.advanced_features = {}

        if advanced_features := get_sanitized_advanced_features(self):
            self.advanced_features = advanced_features

        jsonschema.validate(
            instance=self.advanced_features,
            schema=ADVANCED_FEATURES_PARAMS_SCHEMA,
        )

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

    def _get_additional_fields(self):

        # TODO Remove line below when when every asset is repopulated with `xpath`
        self.known_cols = get_sanitized_known_columns(self)

        return parse_known_cols(self.known_cols)

    def _get_engines(self):
        """
        engines are individual NLP services that can be used
        """
        for instance in self.get_advanced_feature_instances():
            if hasattr(instance, 'engines'):
                for key, val in instance.engines():
                    yield key, val

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

    def _populate_search_field(self):
        if self.owner:
            self.update_search_field(
                owner_username=self.owner.username,
                organization_name=self.owner.organization.name,
            )

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    @transaction.atomic
    def snapshot(
        self,
        regenerate: bool = False,
        version_uid: Optional[str] = None,
        submission_uuid: Optional[str] = None,
        root_node_name: Optional[str] = None,
    ) -> AssetSnapshot:
        if version_uid:
            asset_version = self.asset_versions.get(uid=version_uid)
        else:
            asset_version = self.latest_version

        snap_params = {
            'asset': self,
            'asset_version': asset_version,
        }
        if submission_uuid:
            snap_params['submission_uuid'] = submission_uuid

        if regenerate:
            snapshot = False
        else:
            snapshot = AssetSnapshot.objects.filter(**snap_params).order_by(
                '-date_created'
            ).first()

        if not snapshot:
            try:
                form_title = asset_version.form_title
                content = asset_version.version_content
            except AttributeError:
                form_title = self.form_title
                content = self.content

            settings_ = {'form_title': form_title}

            if root_node_name:
                # `name` may not sound like the right setting to control the
                # XML root node name, but it is, according to the XLSForm
                # specification:
                # https://xlsform.org/en/#specify-xforms-root-node-name
                settings_['name'] = root_node_name
                settings_['id_string'] = root_node_name

            self._append(content, settings=settings_)

            snap_params['source'] = content
            snapshot = AssetSnapshot.objects.create(**snap_params)

        return snapshot

    def _update_partial_permissions(
        self,
        user: 'settings.AUTH_USER_MODEL',
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
            deleted, _ = self.asset_partial_permissions.filter(user_id=user.pk).delete()
            if deleted > 0:
                post_remove_partial_perms.send(
                    sender=self.__class__,
                    instance=self,
                    user=user,
                )

        if perm == PERM_PARTIAL_SUBMISSIONS:

            if remove:
                clean_up_table()
                return

            if user.pk == self.owner.pk:
                raise BadPermissionsException(
                    t("Can not assign '{}' permission to owner".format(perm)))

            if not partial_perms:
                raise BadPermissionsException(
                    t("Can not assign '{}' permission. "
                      "Partial permissions are missing.".format(perm)))

            new_partial_perms = AssetUserPartialPermission\
                .update_partial_perms_to_include_implied(
                    self,
                    partial_perms
                )

            AssetUserPartialPermission.objects.update_or_create(
                asset_id=self.pk,
                user_id=user.pk,
                defaults={'permissions': new_partial_perms})
            post_assign_partial_perm.send(
                sender=self.__class__,
                perms=new_partial_perms,
                instance=self,
                user=user,
            )

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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='b')

    class Meta:
        unique_together = ('asset', 'user')
