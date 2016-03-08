import cStringIO
import datetime
import re
import requests
import unicodecsv

from django.conf import settings
from django.db import models
from jsonfield import JSONField
from pyxform.xls2json_backends import xls_to_dict
from rest_framework import exceptions, status
from rest_framework.authtoken.models import Token
from reversion import revisions as reversion
from shortuuid import ShortUUID

UID_LENGTH = 22

# TODO: Use a better question type to store the version?
VERSION_QUESTION_NAME = '__version__'
VERSION_QUESTION_TYPE = 'calculate'
# Define a function that returns {'column name': 'cell value'}
VERSION_QUESTION_CELL = lambda x: {'calculation': x}

class AssetDeploymentException(exceptions.APIException):
    @property
    def invalid_form_id(self):
        # We recognize certain KC API responses as indications of an
        # invalid form id:
        invalid_form_id_responses = (
            'Form with this id or SMS-keyword already exists.',
            'In strict mode, the XForm ID must be a valid slug and '
                'contain no spaces.',
        )
        return self.detail in invalid_form_id_responses

def kobocat_url(path, internal=False):
    if internal and settings.KOBOCAT_INTERNAL_URL:
        return u''.join([settings.KOBOCAT_INTERNAL_URL, path])
    if settings.KOBOCAT_URL:
        return u''.join([settings.KOBOCAT_URL, path])
    return u"/kobocat%s" % path

def deploy_asset(user, asset, form_id):
    ''' Pass `form_id = None` for a redeployment. The `asset` MUST have already
    been deployed. If it has not, pass a valid slug as `form_id` to perform a
    regular deployment. '''
    if form_id is None:
        redeployment = True
        form_id = asset.xform_id_string
        assert(len(form_id))
        assert(asset.xform_pk is not None)
    else:
        redeployment = False

    (token, is_new) = Token.objects.get_or_create(user=user)
    headers = {u'Authorization':'Token ' + token.key}
    version_extra_row = {
        'name': VERSION_QUESTION_NAME,
        'type': VERSION_QUESTION_TYPE,
    }
    version_extra_row.update(VERSION_QUESTION_CELL(asset.version_id))
    xls_dict = xls_to_dict(asset.to_xls_io(
        extra_rows={'survey': version_extra_row}))
    csv_io = cStringIO.StringIO()
    writer = unicodecsv.writer(
        csv_io, delimiter=',', quotechar='"', quoting=unicodecsv.QUOTE_MINIMAL)
    settings_arr = xls_dict.get('settings', [])
    if len(settings_arr) == 0:
        setting = {}
    else:
        setting = settings_arr[0]
    setting['form_id'] = form_id
    xls_dict['settings'] = [setting]

    for sheet_name, rows in xls_dict.items():
        if re.search(r'_header$', sheet_name):
            continue

        writer.writerow([sheet_name])
        out_keys = []
        out_rows = []
        for row in rows:
            out_row = []
            for key in row.keys():
                if key not in out_keys:
                    out_keys.append(key)
            for out_key in out_keys:
                out_row.append(row.get(out_key, None))
            out_rows.append(out_row)
        writer.writerow([None] + out_keys)
        for out_row in out_rows:
            writer.writerow([None] + out_row)


    valid_xlsform_csv_repr = csv_io.getvalue()
    payload = {u'text_xls_form': valid_xlsform_csv_repr}

    url = kobocat_url('/api/v1/forms', internal=True)
    if redeployment:
        request_method = requests.patch
        url = '{}/{}'.format(url, asset.xform_pk)
        expected_status_code = 200 if redeployment else 201
    else:
        request_method = requests.post
        expected_status_code = 201
    try:
        response = request_method(url, headers=headers, data=payload)
        status_code = response.status_code
    except requests.exceptions.RequestException as e:
        # Failed to access the KC API
        # TODO: clarify that the user cannot correct this
        raise AssetDeploymentException(detail=unicode(e))

    try:
        resp = response.json()
    except ValueError as e:
        # Unparseable KC API output
        # TODO: clarify that the user cannot correct this
        raise AssetDeploymentException(detail=unicode(e))

    if status_code != expected_status_code or (
        'type' in resp and resp['type'] == 'alert-error'
    ) or 'formid' not in resp:
        if 'text' in resp:
            # KC API refused us for a specified reason, likely invalid input
            # Raise a 400 error that includes the reason
            e = AssetDeploymentException(detail=resp['text'])
            e.status_code = status.HTTP_400_BAD_REQUEST
            raise e
        else:
            # Unspecified failure; raise 500
            raise AssetDeploymentException(
                detail='Unexpected KoBoCAT error {}: {}'.format(
                    status_code, response.content)
            )

    # update_params['kobocat_published_form_id'] = resp[u'formid']
    # survey_draft.kobocat_published_form_id = resp[u'formid']
    # survey_draft.save()
    # serializer = DetailSurveyDraftSerializer(survey_draft)
    resp.update({
        u'message': 'Successfully published form',
        u'published_form_url': kobocat_url('/%s/forms/%s' % (user.username, resp.get('id_string')))
        })

    # Update the Asset with details returned by KC
    asset.date_deployed = datetime.datetime.now()
    asset.xform_data = resp
    if redeployment:
        assert(asset.xform_pk == resp['formid'])
        assert(asset.xform_id_string == resp['id_string'])
        assert(asset.xform_uuid == resp['uuid'])
    else:
        asset.xform_pk = resp['formid']
        asset.xform_id_string = resp['id_string']
        asset.xform_uuid = resp['uuid']

    return resp
