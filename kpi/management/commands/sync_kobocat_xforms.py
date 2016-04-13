import datetime
import io
import json
import re
import requests
import xlwt
import StringIO
import dateutil.parser
from optparse import make_option
from pyxform import xls2json_backends

from django.conf import settings
from django.contrib.auth.models import User
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
                    update_existing = False
                    if xform.uuid in kpi_deployed_uuids:
                        # This KC form already has a corresponding KPI asset,
                        # but the user may have directly updated the form on KC
                        # after deploying from KPI. If so, then the KPI asset
                        # must be updated with the contents of the KC form
                        asset = user.assets.get(
                            pk=kpi_deployed_uuids[xform.uuid])
                        time_diff = xform.date_modified - asset.date_modified
                        # Format the timedelta in a sane way, per
                        # http://stackoverflow.com/a/8408947
                        if time_diff < datetime.timedelta(0):
                            time_diff_str = '-{}'.format(-time_diff)
                        else:
                            time_diff_str = '+{}'.format(time_diff)
                        # If the timestamps are close enough, we assume the KC
                        # form content was not updated since the last KPI
                        # deployment
                        if time_diff <= TIMESTAMP_DIFFERENCE_TOLERANCE:
                            print_tabular(
                                'NOOP',
                                user.username,
                                xform.id_string,
                                asset.uid,
                                time_diff_str
                            )
                            continue
                        else:
                            update_existing = True
                    # Load the xlsform from the KC API to avoid having to deal
                    # with S3 credentials, etc.
                    response = kc_forms_api_request(
                        token, xform.pk, xlsform=True)
                    if response.status_code != 200:
                        print_tabular(
                            'FAIL',
                            user.username,
                            xform.id_string,
                            'unable to load xls ({})'.format(
                                response.status_code)
                        )
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
                        print_tabular(
                            'FAIL',
                            user.username,
                            xform.id_string,
                            'unable to load form data ({})'.format(
                                response.status_code)
                        )
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
                        # If this user already has an identically-named asset,
                        # append `xform.id_string` in parentheses for
                        # clarification
                        if Asset.objects.filter(
                                owner=user, name=asset.name).exists():
                            asset.name = u'{} ({})'.format(
                                asset.name, xform.id_string)
                            # `store_data()` handles saving the asset
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
                                time_diff_str
                            )
                        else:
                            print_tabular(
                                'CREATE',
                                user.username,
                                xform.id_string,
                                asset.uid,
                            )
                except Exception as e:
                    print_tabular(
                        'FAIL',
                        user.username,
                        xform.id_string,
                        repr(e)
                    )

        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)
