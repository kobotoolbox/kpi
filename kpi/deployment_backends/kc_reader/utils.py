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
