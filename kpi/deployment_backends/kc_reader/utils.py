import json
from .shadow_models import _models, safe_kc_read
from django.db import ProgrammingError


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
        'name',
        'city',
        'country',
        'organization',
        'home_page',
        'twitter',
        'description',
        'require_auth',
        'address',
        'phonenumber',
        'metadata',
    ]
    result = {}
    for field in fields:
        value = getattr(profile, field)
        if not isinstance(value, basestring):
            value = json.dumps(value)
        result[field] = value
    return result

def set_kc_require_auth(user_id, require_auth):
    ''' WRITES to KC's UserProfile.require_auth '''
    try:
        profile, created = _models.UserProfile.objects.get_or_create(
            user_id=user_id)
        if profile.require_auth != require_auth:
            profile.require_auth = require_auth
            profile.save()
    except ProgrammingError as e:
        raise ProgrammingError(u'set_kc_require_auth error accessing kobocat '
                               u'tables: {}'.format(e.message))
