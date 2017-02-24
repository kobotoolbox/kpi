import StringIO
import datetime
import io
import json
import logging
import re
import requests
import xlwt
from hashlib import md5
from optparse import make_option
from pyxform import xls2json_backends

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import get_storage_class
from django.core.management.base import BaseCommand
from django.db import models, transaction
from rest_framework.authtoken.models import Token

from formpack.utils.xls_to_ss_structure import xls_to_dicts
from hub.models import FormBuilderPreference
from ...deployment_backends.kobocat_backend import KobocatDeploymentBackend
from ...models import Asset
from .import_survey_drafts_from_dkobo import _set_auto_field_update

TIMESTAMP_DIFFERENCE_TOLERANCE = datetime.timedelta(seconds=30)


class SyncKCXFormsError(Exception):
    pass


class SyncKCXFormsWarning(Exception):
    pass


def _add_contents_to_sheet(sheet, contents):
    ''' Copied from dkobo/koboform/pyxform_utils.py '''
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
    ''' Copied from dkobo/koboform/pyxform_utils.py '''
    workbook = xlwt.Workbook()
    for sheet_name in ss_dict.keys():
        # pyxform.xls2json_backends adds "_header" items for each sheet.....
        if not re.match(r".*_header$", sheet_name):
            # Sheets with empty names are rejected by xlwt; omit them
            if not sheet_name:
                continue
            cur_sheet = workbook.add_sheet(sheet_name)
            _add_contents_to_sheet(cur_sheet, ss_dict[sheet_name])
    string_io = StringIO.StringIO()
    workbook.save(string_io)
    string_io.seek(0)
    return string_io


def _xlsform_to_kpi_content_schema(xlsform):
    '''
    parses xlsform structure into json representation
    of spreadsheet structure.
    '''
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
    ''' Returns a `Response` object '''
    url = '{}/api/v1/forms/{}'.format(
        settings.KOBOCAT_INTERNAL_URL, xform_pk)
    if xlsform:
        url += '/form.xls'
    headers = {u'Authorization':'Token ' + token.key}
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
            desired_name = u'{} ({})'.format(
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
            u'unable to load xls ({})'.format(response.status_code)
        )
    elif response.status_code != 200:
        raise SyncKCXFormsError(
            u'unable to load xls ({})'.format(response.status_code)
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
    ''' Returns `True` and appends to `changes` if it modifies `asset`; does
    not save anything '''
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
    backend_response = asset._deployment_data['backend_response']
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
            # We don't need an update, but we should copy the hash from KC to
            # KPI for future reference
            backend_response['hash'] = xform.prefixed_hash
            modified = True
            changes.append('HASH')
        else:
            asset.content = _xform_to_asset_content(xform)
            asset.date_modified = xform.date_modified
            modified = True
            changes.append('UPDATE')
    return modified


def _sync_form_metadata(asset, xform, changes):
    ''' Returns `True` and appends to `changes` if it modifies `asset`; does
    not save anything '''
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
        return True

    modified = False
    fetch_backend_response = False
    deployment_data = asset._deployment_data
    backend_response = deployment_data['backend_response']

    if (
            deployment_data['active'] != xform.downloadable or
            backend_response['downloadable'] != xform.downloadable
    ):
        deployment_data['active'] = xform.downloadable
        modified = True
        fetch_backend_response = True
        changes.append('ACTIVE')

    if settings.KOBOCAT_URL not in deployment_data['identifier']:
        # Issue #1122
        deployment_data[
            'identifier'] = KobocatDeploymentBackend.make_identifier(
                user.username, xform.id_string)
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
        deployment_data[
            'backend_response'] = _get_kc_backend_response(xform)
        modified = True

    return modified


class XForm(models.Model):
    ''' A stripped-down version of `onadata.apps.logger.models.XForm`, included
    here so that we can access KC's data '''
    class Meta:
        app_label = 'logger'
    XFORM_TITLE_LENGTH = 255
    MAX_ID_LENGTH = 100
    xls = models.FileField(null=True)
    xml = models.TextField()
    user = models.ForeignKey(User, related_name='xforms', null=True)
    downloadable = models.BooleanField(default=True)
    id_string = models.SlugField(
        editable=False,
        max_length=MAX_ID_LENGTH
    )
    title = models.CharField(editable=False, max_length=XFORM_TITLE_LENGTH)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    uuid = models.CharField(max_length=32, default=u'')

    @property
    def hash(self):
        return u'%s' % md5(self.xml.encode('utf8')).hexdigest()

    @property
    def prefixed_hash(self):
        ''' Matches what's returned by the KC API '''
        return u"md5:%s" % self.hash


class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--all-users',
                    action='store_true',
                    dest='all_users',
                    default=False,
                    help='Import even when the user does not prefer KPI'),
        make_option('--username',
                    action='store',
                    dest='username',
                    default=False,
                    help="Import only a specific user's forms"),
        make_option('--quiet',
                    action='store_true',
                    dest='quiet',
                    default=False,
                    help='Do not output status messages'),
    )

    def _print_str(self, string):
        if not self._quiet:
            print string

    def _print_tabular(self, *args):
        self._print_str(u'\t'.join(map(lambda x: u'{}'.format(x), args)))

    def handle(self, *args, **options):
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )
        self._quiet = options.get('quiet')
        users = User.objects.all()
        self._print_str('%d total users' % users.count())
        # A specific user or everyone?
        if options.get('username'):
            users = User.objects.filter(username=options.get('username'))
        self._print_str('%d users selected' % users.count())
        # Only users who prefer KPI or all users?
        if not options.get('all_users'):
            users = users.filter(
                models.Q(formbuilderpreference__preferred_builder=
                    FormBuilderPreference.KPI) |
                models.Q(formbuilderpreference=None) # KPI is the default now
            )
            self._print_str('%d of selected users prefer KPI' % users.count())

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
                dd = existing_survey._deployment_data
                try:
                    backend_response = dd['backend_response']
                except KeyError:
                    continue
                xform_uuids_to_asset_pks[backend_response['uuid']] = \
                    existing_survey.pk

            # Use our stub model to access KC's XForm objects
            xforms = user.xforms.all()
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
                    logging.exception(u'sync_kobocat_xforms: {}'.format(
                        u', '.join(error_information)))

        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)
