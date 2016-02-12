from django.db import models
from shortuuid import ShortUUID
from jsonfield import JSONField
from kpi.models import Asset
from rest_framework.authtoken.models import Token
from rest_framework import exceptions, status
from pyxform.xls2json_backends import xls_to_dict
from django.conf import settings
import reversion
import cStringIO
import unicodecsv
import requests
import re

UID_LENGTH = 22

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
    (token, is_new) = Token.objects.get_or_create(user=user)
    headers = {u'Authorization':'Token ' + token.key}
    xls_dict = xls_to_dict(asset.to_xls_io())
    foo = cStringIO.StringIO()
    writer = unicodecsv.writer(
        foo, delimiter=',', quotechar='"', quoting=unicodecsv.QUOTE_MINIMAL)
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


    valid_xlsform_csv_repr = foo.getvalue()
    payload = {u'text_xls_form': valid_xlsform_csv_repr}

    url = kobocat_url('/api/v1/forms', internal=True)
    try:
        response = requests.post(url, headers=headers, data=payload)
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
    if status_code != 201 or (
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
                detail='Unexpected KoBoCAT error {}'.format(status_code)
            )

    # update_params['kobocat_published_form_id'] = resp[u'formid']
    # survey_draft.kobocat_published_form_id = resp[u'formid']
    # survey_draft.save()
    # serializer = DetailSurveyDraftSerializer(survey_draft)
    resp.update({
        u'message': 'Successfully published form',
        u'published_form_url': kobocat_url('/%s/forms/%s' % (user.username, resp.get('id_string')))
        })
    return resp

class AssetDeployment(models.Model):
    '''
    keeping a record of when a user deploys an individual asset.
    '''
    MAX_ID_LENGTH = 100 # Copied from KoBoCAT's XForm model

    user = models.ForeignKey('auth.User')
    date_created = models.DateTimeField(auto_now_add=True)
    asset = models.ForeignKey('kpi.Asset')
    asset_version_id = models.IntegerField()
    xform_pk = models.IntegerField(null=True)
    xform_id_string = models.CharField(max_length=MAX_ID_LENGTH)
    data = JSONField()
    uid = models.CharField(max_length=UID_LENGTH, default='')

    @property
    def state(self):
        return self.data.get('state', None)

    @state.setter
    def state(self, value):
        self.data.set('state', value)

    def deploy_asset(self, form_id):
        return deploy_asset(self.user, self.asset, form_id)

    def save(self, *args, **kwargs):
        if self.data == '':
            self.data = {}
        if self.uid == '':
            self.uid = 'd'+ShortUUID().random(UID_LENGTH-1)
        super(AssetDeployment, self).save(*args, **kwargs)

    @classmethod
    def _create_if_possible(kls, asset, user, xform_id_string):
        asset_version_id = reversion.get_for_object(asset).last().id
        new_ad = AssetDeployment(
            user=user,
            asset=asset,
            asset_version_id=asset_version_id
            )
        # Might raise exceptions, but they're the caller's obligation to handle
        result = new_ad.deploy_asset(xform_id_string)
        new_ad.data = result
        new_ad.xform_pk = result['formid']
        # KC might return something different from what we provided
        new_ad.xform_id_string = result['id_string']
        new_ad.save()
        return new_ad
