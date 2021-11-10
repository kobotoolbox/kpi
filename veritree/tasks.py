from django.db import transaction
import unicodecsv as csv
import requests
from io import BytesIO
from django.core.files.base import ContentFile
from django.core.exceptions import ObjectDoesNotExist
from veritree.models import VeritreeOAuth2
from kpi.serializers.v2.asset_file import AssetFileSerializer

from django.contrib.auth.models import User
from kpi.models import Asset

GROUP_NAME = 'group_nations' # It seems to be the case that the word after group_ has to be 7 characters long in order to properly save with kobo
NATION_QUESTION_NAME = 'Project_Nation'
NATION_LIST_NAME = 'Project_Nation'
REGION_LIST_PREFIX = 'Region_'
REGION_NAME_PREFIX = 'Choose_Planting_Site_'


def generate_org_regions_and_planting_sites_for_asset(user: User, asset: Asset, veritree_org_id = 1) -> bool:
    target_file_name = 'org_data.csv'
    
    if not user or not asset:
        raise TypeError('TypeError None type for user or asset, cannot generate org csv for user')
    
    try:
        veritree_data = user.social_auth.get(provider=VeritreeOAuth2.name).extra_data
        veritree_access_token = veritree_data['access_token']
    except ObjectDoesNotExist:
        raise TypeError('TypeError user social auth does not exist with veritree')

    if not veritree_access_token:
        raise ValueError('ValueError no access token for user')
    
    try:
        veritree_orgs = veritree_data['user_orgs']
        if int(veritree_org_id) not in [veritree_org['org_id'] for veritree_org in veritree_orgs]:
            raise ValueError('ValueError User does not have access to organization id {}'.format(veritree_org_id))
    except (IndexError, KeyError, TypeError):
        raise Exception('Exception No veritree orgs for this user')
    csv_data = get_org_planting_site_and_region_data(veritree_access_token, veritree_org_id)
    
    # TODO: Return a status code???
    modify_survey_questions_and_choices(asset, csv_data)


def get_headers_for_veritree_request(access_token: str):
    headers = {'Authorization': 'Bearer {}'.format(access_token)}
    return headers

def get_org_planting_site_and_region_data(access_token: str, orgId: int):
    """
    This function returns all the country and site data (regions) associated with the org used
    in various forms ex. Socio-economic
    """
    regions_url = '{}/api/subsites'.format(VeritreeOAuth2.ROOT_URL)
    # An org found in the user_orgs object is always of type orgAccount
    
    params = {'org_id': orgId, 'org_type': 'orgAccount', 'page_size': 10000, 'include[]': 'planting_site.country'} 
    
    response = requests.get(regions_url, params=params, headers=get_headers_for_veritree_request(access_token))
    
    # TODO: Follow the pagination here instead of just requesting a very large amount of regions
    if response.status_code == 200:
        try:
            content = response.json()['data']
        except KeyError:
            raise KeyError('KeyError shape of response is not as expected')
        
        country_dict = {}
        for planting_site in content:
            try:
                country_name = planting_site['planting_site']['country']['name']
            except KeyError:
                continue # If planting site doesn't have a country we can't do anything with it anyways
            if country_name in country_dict:
                country_dict[country_name].append(planting_site['name'])
            else:
                country_dict[country_name] = [planting_site['name']]
        return country_dict
    else:
        response.raise_for_status()


def format_site_list_name(site_name) -> str:
    return site_name.strip().replace(' ', '_').replace(',', '-')

def generate_choices_for_nation_and_regions(choices, csv_data, languages):
    new_choices = []
    formatted_nation_names = [format_site_list_name(nation) for nation in csv_data.keys()]
    for choice in choices:
        list_name = choice.get('list_name', '')
        if list_name != NATION_LIST_NAME and not REGION_LIST_PREFIX in list_name:
            new_choices.append(choice)
        # Check if country name is in csv_data and if not must be some other thing
        elif REGION_LIST_PREFIX in list_name and list_name[len(REGION_LIST_PREFIX):] not in formatted_nation_names:
            new_choices.append(choice)

    # Add in new nation list and region lists
    for (nation, regionList) in csv_data.items():
        for region in regionList:
            new_choices.append({
                'name': format_site_list_name(region),
                'label': [region for _ in range(len(languages))],
                'list_name': '{}{}'.format(REGION_LIST_PREFIX, format_site_list_name(nation))
            })
    for nation in csv_data.keys():
        new_choices.append({
            'name': format_site_list_name(nation),
            'label': [nation for _ in range(len(languages))],
            'list_name': NATION_LIST_NAME
        })
    return new_choices

def modify_survey_questions_and_choices(asset: Asset, csv_data: dict) -> None:
    try:
        asset_survey = asset.content['survey']
    except (KeyError):
        raise KeyError('Asset does not have a survey key')

    # Remove old choices from choice array for Nations
    new_choices = generate_choices_for_nation_and_regions(asset.content['choices'], csv_data, asset.summary['languages'])

    begin_group = list(filter(lambda question: (question.get('type', '') == 'begin_group' and question.get('name', ['_']).lower() == GROUP_NAME), asset_survey))

    for group in begin_group:
        group_index = asset_survey.index(group)
        question = asset_survey[group_index]
        csv_nations = [format_site_list_name(nation) for nation in csv_data.keys()]
        while (question.get('type', '') != 'end_group'):
            question_name = question.get('name', '')
            if question_name == NATION_QUESTION_NAME or question.get('$autoname', '') == NATION_QUESTION_NAME:
                asset_survey[group_index]['select_from_list_name'] = NATION_LIST_NAME
            elif question_name[:len(REGION_NAME_PREFIX)] == REGION_NAME_PREFIX:
                if question_name[len(REGION_NAME_PREFIX):] in csv_nations:
                    formatted_region_name = question_name[len(REGION_NAME_PREFIX):]
                    asset_survey[group_index]['select_from_list_name'] = '{}{}'.format(REGION_LIST_PREFIX, formatted_region_name)
                    asset_survey[group_index]['relevant'] = "${{{nation_question}}} = '{nation}'".format(nation_question=NATION_QUESTION_NAME, nation=formatted_region_name)
                    # Keep track of this so that we can add in missing regions
                    csv_nations.remove(formatted_region_name)
            group_index += 1
            question = asset_survey[group_index]
        
        # Add in missing regions appropriately.
        for remaining_nation in csv_nations:
            site_question = {
                'name': 'Choose_Planting_Site_{}'.format(remaining_nation),
                'type': 'select_one',
                # Just use english translations for all default labels
                'label': ['Choose Planting Site ({})'.format(remaining_nation) for language in asset.summary['languages']],
                'relevant': "${{{nation_question}}} = '{nation}'".format(nation_question=NATION_QUESTION_NAME, nation=remaining_nation),
                'select_from_list_name': '{}{}'.format(REGION_LIST_PREFIX, remaining_nation)
            }
            asset_survey.insert(group_index, site_question)
        
        # Now we have to add in the remaining regions that are in the csv that are not already in the survey
        # Then we have to splice the questions back into place in the survey

    with transaction.atomic():
        asset.content['survey'] = asset_survey
        asset.content['choices'] = new_choices
        # asset.content['survey'] = new_survey
        asset.save()