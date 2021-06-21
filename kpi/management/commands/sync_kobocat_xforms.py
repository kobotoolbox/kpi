# coding: utf-8
import datetime
import io
import json
import re
from collections import defaultdict

import requests
import xlwt
from django.conf import settings
from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from formpack.utils.xls_to_ss_structure import xls_to_dicts
from pyxform import xls2json_backends
from rest_framework.authtoken.models import Token

from kpi.constants import PERM_FROM_KC_ONLY
from kpi.utils.log import logging
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatPermission,
    KobocatUserObjectPermission,
    KobocatXForm,
    ShadowModel,
)
from kpi.deployment_backends.kobocat_backend import KobocatDeploymentBackend
from kpi.models import Asset, ObjectPermission
from kpi.utils.object_permission import get_anonymous_user
from kpi.utils.models import _set_auto_field_update

TIMESTAMP_DIFFERENCE_TOLERANCE = datetime.timedelta(seconds=30)

# Swap keys and values so that keys are KC's codenames and values are KPI's
PERMISSIONS_MAP = {kc: kpi for kpi, kc in Asset.KC_PERMISSIONS_MAP.items()}

# Optimization
ASSET_CT = ContentType.objects.get_for_model(Asset)
FROM_KC_ONLY_PERMISSION = Permission.objects.get(
    content_type=ASSET_CT, codename=PERM_FROM_KC_ONLY)
XFORM_CT = ShadowModel.get_content_type_for_model(KobocatXForm)
ANONYMOUS_USER = get_anonymous_user()
# Replace codenames with Permission PKs, remembering the codenames
permission_map_copy = dict(PERMISSIONS_MAP)

KPI_PKS_TO_CODENAMES = {}
for kc_codename, kpi_codename in permission_map_copy.items():
    kc_perm_pk = KobocatPermission.objects.get(
        content_type=XFORM_CT, codename=kc_codename).pk
    kpi_perm_pk = Permission.objects.get(
        content_type=ASSET_CT, codename=kpi_codename).pk

    del PERMISSIONS_MAP[kc_codename]

    PERMISSIONS_MAP[kc_perm_pk] = kpi_perm_pk
    KPI_PKS_TO_CODENAMES[kpi_perm_pk] = kpi_codename

KPI_CODENAMES_TO_PKS = dict(
    zip(KPI_PKS_TO_CODENAMES.values(), KPI_PKS_TO_CODENAMES.keys())
)


class SyncKCXFormsError(Exception):
    pass


class SyncKCXFormsWarning(Exception):
    pass


def _add_contents_to_sheet(sheet, contents):
    """
    Copied from dkobo/koboform/pyxform_utils.py
    """
    cols = []
    for row in contents:
        for key in row.keys():
            if key not in cols:
                cols.append(key)
    for ci, col in enumerate(cols):
        sheet.write(0, ci, col)
    for ri, row in enumerate(contents):
        for ci, col in enumerate(cols):
            val = row.get(col, None)
            if val:
                sheet.write(ri+1, ci, val)


def _convert_dict_to_xls(ss_dict):
    """
    Copied from dkobo/koboform/pyxform_utils.py
    """
    workbook = xlwt.Workbook()
    for sheet_name in ss_dict.keys():
        # pyxform.xls2json_backends adds "_header" items for each sheet.....
        if not re.match(r".*_header$", sheet_name):
            # Sheets with empty names are rejected by xlwt; omit them
            if not sheet_name:
                continue
            cur_sheet = workbook.add_sheet(sheet_name)
            _add_contents_to_sheet(cur_sheet, ss_dict[sheet_name])

    obj = io.BytesIO()
    workbook.save(obj)
    obj.seek(0)
    return obj


def _xlsform_to_kpi_content_schema(xlsform):
    """
    parses xlsform structure into json representation
    of spreadsheet structure.
    """
    content = xls_to_dicts(xlsform)
    # Remove the __version__ calculate question
    content['survey'] = [
        row for row in content['survey'] if not (
            'calculation' in row and row.get('type', None) == 'calculate' and
            row.get('name', None) == '__version__'
        )
    ]
    # a temporary fix to the problem of list_name alias
    # credit to @dorey
    return json.loads(re.sub('list name', 'list_name',
                      json.dumps(content, indent=4)))


def _kc_forms_api_request(token, xform_pk, xlsform=False):
    """ Returns a `Response` object """
    url = '{}/api/v1/forms/{}'.format(
        settings.KOBOCAT_INTERNAL_URL, xform_pk)
    if xlsform:
        url += '/form.xls'
    headers = {'Authorization': 'Token ' + token.key}
    return requests.get(url, headers=headers)


def _make_name_for_asset(asset, xform):
    desired_name = xform.title
    other_assets = Asset.objects.filter(owner=asset.owner)
    if asset.pk:
        other_assets.exclude(pk=asset.pk)
    if other_assets.filter(name=desired_name).exists():
        # The user already has an asset with this name. Append
        # `xform.id_string` in parentheses for clarification
        if desired_name and len(desired_name.strip()):
            desired_name = '{} ({})'.format(
                desired_name, xform.id_string)
        else:
            desired_name = xform.id_string
    return desired_name


def _xform_to_asset_content(xform):
    # Load the xlsform from the KC API to avoid having to deal
    # with S3 credentials, etc.
    user = xform.user
    response = _kc_forms_api_request(user.auth_token, xform.pk, xlsform=True)
    if response.status_code == 404:
        raise SyncKCXFormsWarning(
            'unable to load xls ({})'.format(response.status_code)
        )
    elif response.status_code != 200:
        raise SyncKCXFormsError(
            'unable to load xls ({})'.format(response.status_code)
        )
    # Convert the xlsform to KPI JSON
    xls_io = io.BytesIO(response.content)
    if xform.xls.name.endswith('.csv'):
        dict_repr = xls2json_backends.csv_to_dict(xls_io)
        xls_io = _convert_dict_to_xls(dict_repr)
    asset_content = _xlsform_to_kpi_content_schema(xls_io)
    return asset_content


def _get_kc_backend_response(xform):
    # Get the form data from KC
    user = xform.user
    response = _kc_forms_api_request(user.auth_token, xform.pk)
    if response.status_code == 404:
        raise SyncKCXFormsWarning([
            user.username,
            xform.id_string,
            'unable to load form data ({})'.format(response.status_code)
        ])
    elif response.status_code != 200:
        raise SyncKCXFormsError([
            user.username,
            xform.id_string,
            'unable to load form data ({})'.format(response.status_code)
        ])
    backend_response = response.json()
    return backend_response


def _sync_form_content(asset, xform, changes):
    """
    Returns `True` and appends to `changes` if it modifies `asset`; does
    not save anything
    """
    if not asset.has_deployment:
        # A brand-new asset
        asset.content = _xform_to_asset_content(xform)
        asset.date_created = xform.date_created
        asset.date_modified = xform.date_modified
        changes.append('CREATE CONTENT')
        return True

    modified = False
    # First, compare hashes to see if the KC form content
    # has changed since the last deployment
    backend_response = asset.deployment.backend_response
    if 'hash' in backend_response:
        if backend_response['hash'] != xform.prefixed_hash:
            asset.content = _xform_to_asset_content(xform)
            asset.date_modified = xform.date_modified
            modified = True
            changes.append('UPDATE')
    else:
        # KC's `date_modified` is nearly useless (see
        # https://github.com/kobotoolbox/kpi/issues/661#issuecomment-218073765).
        # Still, in cases where KPI does not yet know the hash, comparing
        # timestamps can sometimes avoid creating duplicate asset versions
        time_diff = xform.date_modified - asset.date_modified
        # If KC timestamp is close enough to the KPI timestamp, we assume the
        # KC form content was not updated since the last KPI deployment
        if time_diff <= TIMESTAMP_DIFFERENCE_TOLERANCE:
            # Don't update the content, but flip `modified` to `True` in order
            # to refresh the backend response. This gets us a matching hash,
            # among other things
            modified = True
            changes.append('HASH')
        else:
            asset.content = _xform_to_asset_content(xform)
            asset.date_modified = xform.date_modified
            modified = True
            changes.append('UPDATE')

    if modified:
        # It's important to update `deployment_data` with the new hash from KC;
        # otherwise, we'll be re-syncing the same content forever (issue #1302)
        asset.deployment.store_data(
            {'backend_response': _get_kc_backend_response(xform)}
        )

    return modified


def _sync_form_metadata(asset, xform, changes):
    """
    Returns `True` and appends to `changes` if it modifies `asset`. If
    `asset` has no primary key, it will be saved to allow permissions to be
    assigned to it
    """
    user = xform.user
    if not asset.has_deployment:
        # A brand-new asset
        asset.date_created = xform.date_created
        kc_deployment = KobocatDeploymentBackend(asset)
        kc_deployment.store_data({
            'backend': 'kobocat',
            'identifier': KobocatDeploymentBackend.make_identifier(
                user.username, xform.id_string),
            'active': xform.downloadable,
            'backend_response': _get_kc_backend_response(xform),
            'version': asset.version_id
        })
        changes.append('CREATE METADATA')
        asset.set_deployment(kc_deployment)
        # `_sync_permissions()` will save `asset` if it has no `pk`
        affected_users = _sync_permissions(asset, xform)
        if affected_users:
            changes.append(
                'PERMISSIONS({})'.format('|'.join(affected_users)))
        return True

    modified = False
    fetch_backend_response = False
    backend_response = asset.deployment.backend_response

    if (asset.deployment.active != xform.downloadable or
            backend_response['downloadable'] != xform.downloadable):
        asset.deployment.store_data({'active': xform.downloadable})
        modified = True
        fetch_backend_response = True
        changes.append('ACTIVE')

    if settings.KOBOCAT_URL not in asset.deployment.identifier:
        # Issue #1122
        asset.deployment.store_data({
            'identifier': KobocatDeploymentBackend.make_identifier(
                user.username, xform.id_string)})
        fetch_backend_response = True
        modified = True
        changes.append('IDENTIFIER')

    # Check to see if the asset name matches the xform title. Per #857, the
    # xform title takes priority.  The first check is a cheap one:
    if asset.name != xform.title:
        # Now do a full check of the name
        desired_name = _make_name_for_asset(asset, xform)
        if asset.name != desired_name:
            asset.name = desired_name
            modified = True
            changes.append('NAME')

    if fetch_backend_response:
        asset.deployment.store_data({
            'backend_response': _get_kc_backend_response(xform)
        })
        modified = True

    affected_users = _sync_permissions(asset, xform)
    if affected_users:
        modified = True
        changes.append('PERMISSIONS({})'.format('|'.join(affected_users)))

    return modified


def _sync_permissions(asset, xform):
    """
    Returns a list of affected users' usernames
    """

    if not settings.SYNC_KOBOCAT_PERMISSIONS:
        return []

    # Get all applicable KC permissions set for this xform
    xform_user_perms = KobocatUserObjectPermission.objects.filter(
        permission_id__in=PERMISSIONS_MAP.keys(),
        content_type=XFORM_CT,
        object_pk=xform.pk
    ).values_list('user', 'permission')

    if not xform_user_perms and not asset.pk:
        # Nothing to do
        return []

    if not asset.pk:
        # Asset must have a primary key before working with its permissions
        asset.save()

    # Translate KC permissions to KPI permissions and store as dictionary of
    # { user: set(perm1, perm2, ...) }
    translated_kc_perms = defaultdict(set)
    for user, kc_permission in xform_user_perms:
        translated_kc_perms[user].add(PERMISSIONS_MAP[kc_permission])

    # Note that certain KPI permissions should be granted if corresponding
    # flags on the KC `XForm` are set
    for kpi_codename, xform_flags in (
        Asset.KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS.items()
    ):
        all_flags_set = True
        for flag, value_when_set in xform_flags.items():
            if getattr(xform, flag) != value_when_set:
                all_flags_set = False
                break
        if not all_flags_set:
            continue

        translated_kc_perms[ANONYMOUS_USER.pk].add(
            KPI_CODENAMES_TO_PKS[kpi_codename]
        )

    # Get existing KPI permissions in same dictionary format
    current_kpi_perms = defaultdict(set)
    for user, kpi_permission in ObjectPermission.objects.filter(
                deny=False,
                asset=asset,
            ).values_list('user', 'permission'):
        current_kpi_perms[user].add(kpi_permission)

    # Look for users in KPI but not in KC. Their permissions may have come from
    # KC but were later revoked
    for user in set(current_kpi_perms.keys()).difference(translated_kc_perms):
        translated_kc_perms[user] = set()

    affected_usernames = []
    for user, expected_perms in translated_kc_perms.items():
        if user == xform.user_id:
            # No need sync the owner's permissions
            continue
        # KC does not assign implied permissions, so we have to do the work of
        # resolving them
        implied_perms = set()
        for p in expected_perms:
            implied_perms.update(
                Asset.get_implied_perms(KPI_PKS_TO_CODENAMES[p])
            )
        # Only consider relevant implied permissions
        implied_perms.intersection_update(KPI_PKS_TO_CODENAMES.values())
        # Convert from permission codenames back to PKs
        expected_perms.update(
            [KPI_CODENAMES_TO_PKS[codename] for codename in implied_perms]
        )
        user_obj = User.objects.get(pk=user)
        all_kpi_perms = current_kpi_perms[user]
        mapped_kpi_perms = current_kpi_perms[user].intersection(
            PERMISSIONS_MAP.values())
        perms_to_assign = expected_perms.difference(mapped_kpi_perms)
        perms_to_revoke = mapped_kpi_perms.difference(expected_perms)
        all_revoked = perms_to_revoke and not bool(
            mapped_kpi_perms.difference(perms_to_revoke))
        if not all_kpi_perms and perms_to_assign:
            # The user has no existing KPI permissions; assign a special flag
            # permission noting that their only reason for access is this
            # synchronization script
            ObjectPermission.objects.get_or_create(
                user_id=user,
                permission=FROM_KC_ONLY_PERMISSION,
                asset=asset,
            )
        for p in perms_to_assign:
            asset.assign_perm(user_obj, KPI_PKS_TO_CODENAMES[p], skip_kc=True)
        for p in perms_to_revoke:
            asset.remove_perm(user_obj, KPI_PKS_TO_CODENAMES[p], skip_kc=True)
        if all_revoked and FROM_KC_ONLY_PERMISSION.pk in all_kpi_perms:
            # This user's KPI access came only from this script, and now all KC
            # permissions have been removed. Purge all KPI grant permissions,
            # even the non-mapped ones, in order to clean up prerequisite
            # permissions (e.g. 'view_asset' is a prerequisite of
            # 'view_submissions')
            ObjectPermission.objects.filter(
                user_id=user,
                deny=False,
                asset=asset,
            ).delete()
        if perms_to_assign or perms_to_revoke:
            affected_usernames.append(user_obj.username)

    return affected_usernames


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=False,
            help="Import only a specific user's forms"
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            dest='quiet',
            default=False,
            help='Do not output status messages'
        )
        parser.add_argument(
            '--populate-xform-kpi-asset-uid',
            action='store_true',
            dest='populate_xform_kpi_asset_uid',
            default=False,
            help='Populate XForm `kpi_asset_uid` field')
        parser.add_argument(
            '--sync-kobocat-form-media',
            action='store_true',
            dest='sync_kobocat_form_media',
            default=False,
            help='Sync kobocat form-media to kpi')

    def _print_str(self, string):
        if not self._quiet:
            print(string)

    def _print_tabular(self, *args):
        self._print_str('\t'.join(['{}'.format(x) for x in args]))

    def handle(self, *args, **options):
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )
        self._quiet = options.get('quiet')
        username = options.get('username')
        populate_xform_kpi_asset_uid = options.get('populate_xform_kpi_asset_uid')
        sync_kobocat_form_media = options.get('sync_kobocat_form_media')
        verbosity = options.get('verbosity')
        users = User.objects.all()
        # Do a basic query just to make sure the KobocatXForm model is
        # loaded
        if not KobocatXForm.objects.exists():
            return
        self._print_str('%d total users' % users.count())
        # A specific user or everyone?
        if username:
            users = User.objects.filter(username=username)
        self._print_str('%d users selected' % users.count())

        # We'll be copying the date fields from KC, so don't auto-update them
        _set_auto_field_update(Asset, "date_created", False)
        _set_auto_field_update(Asset, "date_modified", False)

        for user in users:
            # Make sure the user has a token for access to KC's API
            Token.objects.get_or_create(user=user)

            existing_surveys = user.assets.filter(asset_type='survey')

            # Each asset that the user has already deployed to KC should have a
            # form uuid stored in its deployment data
            xform_uuids_to_asset_pks = {}
            for existing_survey in existing_surveys:
                if not existing_survey.has_deployment:
                    continue
                backend_response = existing_survey.deployment.backend_response
                xform_uuids_to_asset_pks[backend_response['uuid']] = \
                    existing_survey.pk

            # KobocatXForm has a foreign key on KobocatUser, not on User
            xforms = KobocatXForm.objects.filter(user_id=user.pk).all()
            for xform in xforms:
                try:
                    with transaction.atomic():
                        if xform.uuid not in xform_uuids_to_asset_pks:
                            # This is an orphaned KC form. Build a new asset to
                            # match
                            asset = Asset(asset_type='survey', owner=user)
                            asset.name = _make_name_for_asset(asset, xform)
                        else:
                            asset = Asset.objects.get(
                                pk=xform_uuids_to_asset_pks[xform.uuid])

                        changes = []
                        try:
                            content_changed = _sync_form_content(
                                asset, xform, changes)
                            metadata_changed = _sync_form_metadata(
                                asset, xform, changes)
                        except SyncKCXFormsWarning as e:
                            error_information = [
                                'WARN',
                                user.username,
                                xform.id_string,
                                e.message
                            ]
                            self._print_tabular(*error_information)
                            continue

                        if content_changed or metadata_changed:
                            # preserve the original "asset.content"
                            asset.save(adjust_content=False)
                            # save a new version with standardized content
                            asset.save()
                            if content_changed:
                                asset._mark_latest_version_as_deployed()
                            self._print_tabular(
                                ','.join(changes),
                                user.username,
                                xform.id_string,
                                asset.uid
                            )
                        else:
                            self._print_tabular(
                                'NOOP',
                                user.username,
                                xform.id_string,
                                asset.uid
                            )
                except Exception as e:
                    error_information = [
                        'FAIL',
                        user.username,
                        xform.id_string,
                        repr(e)
                    ]
                    self._print_tabular(*error_information)
                    logging.exception('sync_kobocat_xforms: {}'.format(
                        ', '.join(error_information)))

        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)

        if populate_xform_kpi_asset_uid:
            call_command(
                'populate_kc_xform_kpi_asset_uid',
                username=username,
                verbosity=verbosity,
            )

        if sync_kobocat_form_media:
            call_command(
                'sync_kobocat_form_media',
                username=username,
                quiet=self._quiet,
                verbosity=verbosity,
            )
