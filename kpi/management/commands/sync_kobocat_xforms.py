import StringIO
import datetime
import dateutil.parser
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

def convert_dict_to_xls(ss_dict):
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

def xlsform_to_kpi_content_schema(xlsform):
    '''
    parses xlsform structure into json representation
    of spreadsheet structure.
    '''
    content = xls_to_dicts(xlsform)
    # Remove the __version__ calculate question
    content['survey'] = [
        row for row in content['survey'] if not (
            'calculation' in row and row['type'] == 'calculate' and
            row['name'] == '__version__'
        )
    ]
    # a temporary fix to the problem of list_name alias
    # credit to @dorey
    return json.loads(re.sub('list name', 'list_name',
                  json.dumps(content, indent=4)))

def kc_forms_api_request(token, xform_pk, xlsform=False):
    ''' Returns a `Response` object '''
    url = '{}/api/v1/forms/{}'.format(
        settings.KOBOCAT_INTERNAL_URL, xform_pk)
    if xlsform:
        url += '/form.xls'
    headers = {u'Authorization':'Token ' + token.key}
    return requests.get(url, headers=headers)

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

    def handle(self, *args, **options):
        if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
            raise ImproperlyConfigured(
                'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                'configured before using this command'
            )
        if options.get('quiet'):
            # Do not output anything
            def print_str(string): pass
        else:
            # Output status messages
            def print_str(string): print string

        def print_tabular(*args):
            print_str(u'\t'.join(map(lambda x: u'{}'.format(x), args)))

        users = User.objects.all()
        print_str('%d total users' % users.count())
        # A specific user or everyone?
        if options.get('username'):
            users = User.objects.filter(username=options.get('username'))
        print_str('%d users selected' % users.count())
        # Only users who prefer KPI or all users?
        if not options.get('all_users'):
            users = users.filter(
                models.Q(formbuilderpreference__preferred_builder=
                    FormBuilderPreference.KPI) |
                models.Q(formbuilderpreference=None) # KPI is the default now
            )
            print_str('%d of selected users prefer KPI' % users.count())

        # We'll be copying the date fields from KC, so don't auto-update them
        _set_auto_field_update(Asset, "date_created", False)
        _set_auto_field_update(Asset, "date_modified", False)

        for user in users:
            (token, created) = Token.objects.get_or_create(user=user)
            existing_surveys = user.assets.filter(asset_type='survey')

            # Each asset that the user has already deployed to KC should have a
            # form uuid stored in its deployment data
            kpi_deployed_uuids = {}
            for existing_survey in existing_surveys:
                dd = existing_survey._deployment_data
                if 'backend_response' in dd:
                    kpi_deployed_uuids[dd['backend_response']['uuid']] = \
                        existing_survey.pk
            # Use our stub model to access KC's XForm objects
            xforms = user.xforms.all()
            for xform in xforms:
                try:
                    if xform.uuid in kpi_deployed_uuids:
                        # This KC form already has a corresponding KPI asset,
                        # but the user may have directly updated the form on KC
                        # after deploying from KPI. If so, then the KPI asset
                        # must be updated with the contents of the KC form
                        asset = user.assets.get(
                            pk=kpi_deployed_uuids[xform.uuid])
                        non_content_operation = 'NOOP'
                        # First, compare hashes to see if the KC form content
                        # has changed since the last deployment
                        backend_response = asset._deployment_data[
                            'backend_response']
                        if 'hash' in backend_response:
                            update_existing = backend_response['hash'] \
                                != xform.prefixed_hash
                            diff_str = 'hashes {}'.format(
                                'differ' if update_existing else 'match')
                        else:
                            # KC's `date_modified` is nearly useless, because
                            # every new submission changes it to the current
                            # time, and when there are no submissions, merely
                            # loading the projects list does the same (see
                            # https://github.com/kobotoolbox/kpi/issues/661#issuecomment-218073765).
                            # Still, in cases where KPI does not yet know the
                            # hash, comparing timestamps can sometimes save us
                            # from creating duplicate asset versions
                            time_diff = xform.date_modified - asset.date_modified
                            # Format the timedelta in a sane way, per
                            # http://stackoverflow.com/a/8408947
                            if time_diff < datetime.timedelta(0):
                                diff_str = '-{}'.format(-time_diff)
                            else:
                                diff_str = '+{}'.format(time_diff)
                            # If KC timestamp is sufficiently ahead of the KPI
                            # timestamp, we assume the KC form content was
                            # updated since the last KPI deployment
                            if time_diff > TIMESTAMP_DIFFERENCE_TOLERANCE:
                                update_existing = True
                            else:
                                update_existing = False
                                # We don't need an update, but we should copy
                                # the hash from KC to KPI for future reference
                                non_content_operation = 'HASH'
                                backend_response['hash'] = xform.prefixed_hash
                                asset.save()

                        if not update_existing:
                            # No update needed. Skip to the next form
                            print_tabular(
                                non_content_operation,
                                user.username,
                                xform.id_string,
                                asset.uid,
                                diff_str
                            )
                            continue
                    else:
                        update_existing = False
                    # Load the xlsform from the KC API to avoid having to deal
                    # with S3 credentials, etc.
                    response = kc_forms_api_request(
                        token, xform.pk, xlsform=True)
                    if response.status_code != 200:
                        error_information = [
                            'FAIL',
                            user.username,
                            xform.id_string,
                            u'unable to load xls ({})'.format(
                                response.status_code)
                        ]
                        print_tabular(*error_information)
                        logging.warning(u'sync_kobocat_xforms: {}'.format(
                            u', '.join(error_information)))
                        continue
                    # Convert the xlsform to KPI JSON
                    xls_io = io.BytesIO(response.content)
                    if xform.xls.name.endswith('.csv'):
                        dict_repr = xls2json_backends.csv_to_dict(xls_io)
                        xls_io = convert_dict_to_xls(dict_repr)
                    asset_content = xlsform_to_kpi_content_schema(xls_io)
                    # Get the form data from KC
                    response = kc_forms_api_request(token, xform.pk)
                    if response.status_code != 200:
                        error_information = [
                            'FAIL',
                            user.username,
                            xform.id_string,
                            'unable to load form data ({})'.format(
                                response.status_code)
                        ]
                        print_tabular(*error_information)
                        logging.error(u'sync_kobocat_xforms: {}'.format(
                            u', '.join(error_information)))
                        continue
                    deployment_data = response.json()
                    with transaction.atomic():
                        if not update_existing:
                            # This is an orphaned KC form. Build a new asset to
                            # match it
                            asset = Asset()
                            asset.asset_type = 'survey'
                            asset.owner = user
                            asset.date_created = dateutil.parser.parse(
                                deployment_data['date_created'])
                        # Update the asset's modification date and content
                        # regardless of whether it's a new asset or an existing
                        # one being updated
                        asset.date_modified = dateutil.parser.parse(
                            deployment_data['date_modified'])
                        asset.content = asset_content
                        asset.save()
                        # The first save handles pulling the form title from
                        # the settings sheet. If this user already has a
                        # different but identically-named asset, append
                        # `xform.id_string` in parentheses for clarification
                        if Asset.objects.exclude(pk=asset.pk).filter(
                                owner=user, name=asset.name).exists():
                            if asset.name and len(asset.name.strip()):
                                asset.name = u'{} ({})'.format(
                                    asset.name, xform.id_string)
                            else:
                                asset.name = xform.id_string
                            # Don't call `asset.save()` since `store_data()`
                            # handles saving the asset
                        # Copy the deployment-related data
                        kc_deployment = KobocatDeploymentBackend(asset)
                        kc_deployment.store_data({
                            'backend': 'kobocat',
                            'identifier': kc_deployment.make_identifier(
                                user.username, xform.id_string),
                            'active': xform.downloadable,
                            'backend_response': deployment_data,
                            'version': asset.version_id
                        })
                        if update_existing:
                            print_tabular(
                                'UPDATE',
                                user.username,
                                xform.id_string,
                                asset.uid,
                                diff_str
                            )
                        else:
                            print_tabular(
                                'CREATE',
                                user.username,
                                xform.id_string,
                                asset.uid,
                            )
                except Exception as e:
                    error_information = [
                        'FAIL',
                        user.username,
                        xform.id_string,
                        repr(e)
                    ]
                    print_tabular(*error_information)
                    logging.exception(u'sync_kobocat_xforms: {}'.format(
                        u', '.join(error_information)))

        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)
