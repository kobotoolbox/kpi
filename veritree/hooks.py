import json

from re import sub
from django.conf import settings
from veritree.models import VeritreeOAuth2

METATADATA_FORM_API = f"{VeritreeOAuth2.ROOT_URL}/api/form-submissions"
FIELD_UPDATE_API = f"{VeritreeOAuth2.ROOT_URL}/api/fields"

def get_metadata_from_submission(submission_data, project_name, orgId) -> dict:
    if not submission_data:
        raise TypeError({'message': 'None Type received for get_metadata_from_submission'})

    point = get_point(submission_data)
    submission_link = get_submission_link(submission_data)
    return {
        "submitted_at": get_date(submission_data),
        "form_name": project_name,
        "url_json": submission_link + '?format=json',
        "url_xml": submission_link + '?format=xml',
        "latitude": point[0],
        "longitude": point[1],
        "form_name": project_name,
        "org_id": orgId,
        "org_type": "organization",
        "external_submission_id": f"{submission_data['_id']}", #Use a string?
        "form_uid": get_project_link(submission_data) #form_id???
    }

def get_date(submission_data) -> str:
    potential_keys = ['_submission_time', 'date', 'Date', 'end']
    for key in potential_keys:
        if key in submission_data:
            return submission_data[key].replace('T', ' ')
    return ''

def get_submission_link(submission_data) -> str:
    print(submission_data)
    form_uuid = submission_data['_xform_id_string']
    submission_id = submission_data['_id']
    return f"{settings.KPI_URL}/api/v2/assets/{form_uuid}/data/{submission_id}/"

def get_project_link(submission_data) -> str:
    form_uuid = submission_data['_xform_id_string']
    # return f"{settings.KPI_URL}/#/forms/{form_uuid}/data/table"
    return form_uuid

def get_point(submission_data) -> tuple or None:
    potential_keys_string = ['GPS', 'gps']
    potential_keys_tuple = ['_geolocation']
    for key in (potential_keys_string + potential_keys_tuple):
        if key in submission_data and key in potential_keys_string:
            gps_data = submission_data[key].split(' ')
            return tuple([gps_data[0], gps_data[1]])
        elif key in submission_data and key in potential_keys_tuple:
            return submission_data[key]
    return None
