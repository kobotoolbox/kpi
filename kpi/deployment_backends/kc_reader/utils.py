import json

from django.conf import settings
from django.contrib.auth.models import User
from django.db import ProgrammingError
from rest_framework.authtoken.models import Token
import requests

from .shadow_models import _models, safe_kc_read


@safe_kc_read
def instance_count(xform_id_string, user_id):
    return _models.Instance.objects.filter(deleted_at__isnull=True,
                                           xform__user_id=user_id,
                                           xform__id_string=xform_id_string,
                                           ).count()

@safe_kc_read
def get_kc_profile_data(user_id):
    ''' Retrieve all fields from the user's KC profile (if it exists) and
    return them in a dictionary '''
    try:
        profile = _models.UserProfile.objects.get(user_id=user_id)
    except _models.UserProfile.DoesNotExist:
        return {}
    fields = [
        # Use a (kc_name, new_name) tuple to rename a field
        'name',
        'organization',
        ('home_page', 'organization_website'),
        ('description', 'bio'),
        ('phonenumber', 'phone_number'),
        'address',
        'city',
        'country',
        'require_auth',
        'twitter',
        'metadata',
    ]
    result = {}
    for field in fields:
        if isinstance(field, tuple):
            kc_name, field = field
        else:
            kc_name = field
        value = getattr(profile, kc_name)
        # When a field contains JSON (e.g. `metadata`), it gets loaded as a
        # `dict`. Convert it back to a string representation
        if isinstance(value, dict):
            value = json.dumps(value)
        result[field] = value
    return result


def set_kc_require_auth(user_id, require_auth):
    '''
    Configure whether or not authentication is required to see and submit data to a user's projects.
    WRITES to KC's UserProfile.require_auth

    :param int user_id: ID/primary key of the :py:class:`User` object.
    :param bool require_auth: The desired setting.
    '''

    # Get/generate the user's auth. token.
    user = User.objects.get(pk=user_id)
    token, is_new = Token.objects.get_or_create(user=user)

    # Trigger the user's KoBoCAT profile to be generated if it doesn't exist.
    url = settings.KOBOCAT_URL + '/api/v1/user'
    response = requests.get(url, headers={'Authorization': 'Token ' + token.key})
    if not response.status_code == 200:
        raise RuntimeError('Bad HTTP status code `{}` when retrieving KoBoCAT user profile'
                           ' for `{}`.'.format(response.status_code, user.username))

    try:
        profile = _models.UserProfile.objects.get(
            user_id=user_id)
        if profile.require_auth != require_auth:
            profile.require_auth = require_auth
            profile.save()
    except ProgrammingError as e:
        raise ProgrammingError(u'set_kc_require_auth error accessing kobocat '
                               u'tables: {}'.format(e.message))
