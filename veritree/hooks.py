import requests
from django.conf import settings

from veritree.models import VeritreeOAuth2
from veritree.question_blocks.constants import (
    planting_site_question,
    FOREST_TYPE_AND_SPECIES_BY_ORG_NAME_PREFIX,
    FOREST_TYPES_SPECIES_BY_ORG_GROUP_NAME,
    NATION_GROUP_NAME,
    NATION_QUESTION_NAME,
    amount_planted_question,
    enter_by_question,
    by_species_option
)
from veritree.question_blocks.utils import unformat_question_name
from veritree.utils import get_veritree_default_org_params, parse_veritree_response, get_headers_for_veritree_request
from veritree.common_urls import SUBSITE_API, REGION_API


def get_metadata_from_submission(submission_data: dict, project_name, orgId: int, access_token: str) -> dict:
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
        "form_uid": get_project_link(submission_data), #form_id???
        "country_id": lookup_country_id(orgId, access_token, get_country_name(submission_data))
    }

def get_field_update_date(submission_data: dict):
    potential_keys = ['date', 'Date']
    for key in potential_keys:
        if key in submission_data:
            return submission_data[key].replace('T', ' ') # Use a date library
def get_date(submission_data: dict) -> str:
    potential_keys = ['end', 'date', 'Date'] # '_submission_time', 
    for key in potential_keys:
        if key in submission_data:
            return submission_data[key].replace('T', ' ')
    return ''

def get_country_name(submission_data: dict) -> str:
    country_name_keys = [NATION_QUESTION_NAME, f"{NATION_GROUP_NAME}/{NATION_QUESTION_NAME}", 'Nation']
    for key in country_name_keys:
        if key in submission_data:
            return submission_data[key]
    return ''

def get_submission_link(submission_data: dict) -> str:
    form_uuid = submission_data['_xform_id_string']
    submission_id = submission_data['_id']
    return f"{settings.KPI_URL}/api/v2/assets/{form_uuid}/data/{submission_id}/"

def get_project_link(submission_data: dict) -> str:
    form_uuid = submission_data['_xform_id_string']
    return f"{settings.KPI_URL}/#/forms/{form_uuid}/data/table"

def get_point(submission_data: dict) -> tuple or None:
    potential_keys_string = ['GPS', 'gps']
    potential_keys_tuple = ['_geolocation']
    for key in (potential_keys_string + potential_keys_tuple):
        if key in submission_data and key in potential_keys_string:
            gps_data = submission_data[key].split(' ')
            return tuple([gps_data[0], gps_data[1]])
        elif key in submission_data and key in potential_keys_tuple:
            return submission_data[key]
    return None

def get_amount_planted(submission_data: dict) -> int:
    planted_by = submission_data[f"{FOREST_TYPES_SPECIES_BY_ORG_GROUP_NAME}/{enter_by_question}"]

    if planted_by == by_species_option:
        species_keys = [key for key in submission_data.keys() if FOREST_TYPE_AND_SPECIES_BY_ORG_NAME_PREFIX in key]
        return sum([int(submission_data[key]) for key in species_keys])
    else:
        return submission_data[f"{FOREST_TYPES_SPECIES_BY_ORG_GROUP_NAME}/{amount_planted_question}"]

def get_field_update_from_submission(submission_data: dict, org_id, access_token) -> dict:
    if not submission_data:
        raise TypeError({'message': 'None Type received for get_field_update_from_submission'})
    
    point = get_point(submission_data)
    planting_site_question_prefix = f"{NATION_GROUP_NAME}/{planting_site_question}"
    planting_site_name = [submission_data[submission_key] for submission_key in submission_data.keys() if planting_site_question_prefix in submission_key][0]
    org_data = lookup_subsite_and_planting_site_id(planting_site_name, org_id, access_token)
    return {
        "name_team_leader": submission_data['Name_Project_Lead'],
        "number_crew_members": 1,
        "number_women_crew": 0,
        "latitude": point[0],
        "longitude": point[1],
        "planting_site_id": org_data['planting_site_id'],
        "subsite_id": org_data['subsite_id'],
        "amount_planted": get_amount_planted(submission_data),
        "date_planted": get_field_update_date(submission_data),
        "verify_trees": "off"
    }

def lookup_subsite_and_planting_site_id(subsite_name: str, org_id: int, access_token: str) -> dict:
    params = get_veritree_default_org_params(org_id) 
    
    response = requests.get(SUBSITE_API, params=params, headers=get_headers_for_veritree_request(access_token))
    content = parse_veritree_response(response)
    if content:
        for subsite in content:
            if subsite['name'].lower() == unformat_question_name(subsite_name).lower():
                return { "planting_site_id": subsite['planting_site_id'], "subsite_id": subsite['id'] }
    
    return { "planting_site_id" : -1, "subsite_id": -1 } # guaranteed to cause an error

def lookup_country_id(org_id: int, access_token: str, country_name: str) -> dict:
    params = get_veritree_default_org_params(org_id)
    params['fields'] = 'country.name'
    params['pageSize'] = 1000
    response = requests.get(REGION_API, params=params, headers=get_headers_for_veritree_request(access_token))
    content = parse_veritree_response(response)
    if content:
        for region in content:
            if region['country'] and region['country']['name'].lower() == unformat_question_name(country_name.lower()):
                return region['country']['id']
    return -1 # guaranteed to cause an error

