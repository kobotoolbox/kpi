from django.db import transaction
import requests
from django.core.exceptions import ObjectDoesNotExist
from veritree.models import VeritreeOAuth2
from kpi.serializers.v2.asset_file import AssetFileSerializer

from copy import deepcopy
from django.contrib.auth.models import User
from kpi.models import Asset

NATION_GROUP_NAME = 'group_nations' # It seems to be the case that the word after group_ has to be 7 characters long in order to properly save with kobo
FOREST_TYPES_BY_NATION_GROUP_NAME = 'group_forestN'
FOREST_TYPES_BY_ORG_GROUP_NAME = 'group_forestO'
NATION_QUESTION_NAME = 'Project_Nation'
NATION_LIST_NAME = 'Project_Nation_'
REGION_LIST_PREFIX = 'Region_'
REGION_NAME_PREFIX = 'Choose_Planting_Site_'
FOREST_TYPE_BY_NATION_LIST_PREFIX = 'Forest_Type_Nation_'
FOREST_TYPE_BY_ORG_LIST_PREFIX = 'Forest_Type_Org'
FOREST_TYPE_BY_ORG_NAME_PREFIX = 'Choose_Forest_Type'
FOREST_TYPE_BY_NATION_NAME_PREFIX = 'Choose_Forest_Type_'
PLACEHOLDER_QUESTION = 'placeholder'
NATION_AFFIX_LIST_NAMES = [REGION_LIST_PREFIX, FOREST_TYPE_BY_NATION_LIST_PREFIX]
REQUIRES_NATION_LIST = [NATION_GROUP_NAME, FOREST_TYPES_BY_NATION_GROUP_NAME]

# Util functions
def format_site_list_name(site_name) -> str:
    return site_name.strip().replace(' ', '_').replace(',', '-')

def get_headers_for_veritree_request(access_token: str):
    headers = {'Authorization': 'Bearer {}'.format(access_token)}
    return headers

def create_nation_type_question(name_prefix, list_prefix, nation, languages):
    return {
        'name': '{}{}'.format(name_prefix, nation),
        'type': 'select_one',
        # Just use english translations for all default labels
        'label': ['{}({})'.format(name_prefix.replace('_', ' '), nation) for language in languages], # English as default for all translations
        'relevant': "${{{nation_question}}} = '{nation}'".format(nation_question=NATION_QUESTION_NAME, nation=nation),
        'select_from_list_name': '{}{}'.format(list_prefix, nation)
    }

def create_select_one_type_question(name_prefix, list_prefix, languages):
    return {
        'name': '{}'.format(name_prefix),
        'type': 'select_one',
        # Just use english translations for all default labels
        'label': ['{}'.format(name_prefix.replace('_', ' ')) for language in languages], # English as default for all translations
        'select_from_list_name': '{}'.format(list_prefix) 
    }

# Algorithm
# generate_org_regions_and_planting_sites_for_asset ->
# get org data ->
# modify survey ->
#    generate_new_choices + keep unaffected choices
#    generate_new_questions
# save survey

def generate_org_regions_and_planting_sites_for_asset(user: User, asset: Asset, veritree_org_id = 1) -> bool:
    if not user or not asset:
        raise TypeError('TypeError None type for user or asset, cannot generate org data for user')
    
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
    region_and_planting_data = get_org_planting_site_and_region_data(veritree_access_token, veritree_org_id)
    
    # TODO: Return a status code???
    modify_survey_questions_and_choices(asset, region_and_planting_data)
    return True

def get_org_planting_site_and_region_data(access_token: str, org_id: int):
    """
    This function returns all the country and site data (regions) associated with the org used
    in various forms ex. Socio-economic
    """
    regions_url = '{}/api/subsites'.format(VeritreeOAuth2.ROOT_URL)
    # An org found in the user_orgs object is always of type orgAccount
    
    params = {'org_id': org_id, 'org_type': 'orgAccount', 'page_size': 10000, 'include[]': 'planting_site.country', 'fields': 'forest_type.name'} 
    
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
                forest_type = planting_site['forest_type']['name']
            except KeyError:
                continue # If planting site doesn't have a country we can't do anything with it anyways
            if country_name in country_dict:
                country_dict[country_name]['planting_sites'].append(planting_site['name'])
                country_dict[country_name]['forest_types'].add(forest_type)
            else:
                country_dict[country_name] = {'planting_sites': [planting_site['name']], 'forest_types': set([forest_type])}
        return country_dict
    else:
        response.raise_for_status()

def generate_choices_for_group(org_data: dict, languages: "list[str]", list_prefix: str, org_data_key: str):
    """
    Choices have to be generated for each question block, but we don't want to make any duplicate lists
    """
    new_choices = []
    seen = set()
    has_nation_affix = list_prefix in [REGION_LIST_PREFIX, FOREST_TYPE_BY_NATION_LIST_PREFIX]
    for (nation, country_data) in org_data.items():
        if has_nation_affix:
            seen = set()
        for org_data_value in country_data[org_data_key]:
            new_choice = {}
            if has_nation_affix:
                new_choice = {
                    'name': format_site_list_name(org_data_value),
                    'label': [org_data_value for _ in languages],
                    'list_name': '{}{}'.format(list_prefix, format_site_list_name(nation)) 
                }
            else:
                new_choice = {
                    'name': format_site_list_name(org_data_value),
                    'label': [org_data_value for _ in languages],
                    'list_name': '{}'.format(list_prefix) 
                }
            t = new_choice['name']
            if t not in seen:
                seen.add(t)
                new_choices.append(new_choice)

    return new_choices

def generate_nation_choices(org_data, languages: "list[str]"):
    new_choices = []
    for nation in org_data.keys():
        new_choices.append({
            'name': format_site_list_name(nation),
            'label': [nation for _ in languages],
            'list_name': '{}'.format(NATION_LIST_NAME) 
        })
    return new_choices

def get_unaffected_choices(choices: list, exclude_prefix_list: "list[str]"):
    new_choices = []
    for choice in choices:
        list_name = choice.get('list_name', '')
        has_prefix = False
        for prefix in exclude_prefix_list:
            if prefix in list_name:
                has_prefix = True
        if not has_prefix:
            new_choices.append(choice)
    
    return new_choices

def modify_nation_group(org_data: dict, survey: list, group: dict, languages: "list[str]", name_prefix: str, list_prefix: str):
    group_index = survey.index(group)
    question = survey[group_index]
    csv_nations = [format_site_list_name(nation) for nation in org_data.keys()]
    while (question.get('type', '') != 'end_group'):
        question_name = question.get('name', '')
        if question_name == PLACEHOLDER_QUESTION or question.get('$autoname', '') == PLACEHOLDER_QUESTION:
            survey.remove(question)
            question = survey[group_index]
            continue
        
        if question_name == NATION_QUESTION_NAME or question.get('$autoname', '') == NATION_QUESTION_NAME:
            survey[group_index]['select_from_list_name'] = NATION_LIST_NAME
        elif question_name[:len(name_prefix)] == name_prefix:
            if question_name[len(name_prefix):] in csv_nations:
                formatted_region_name = question_name[len(name_prefix):]
                survey[group_index]['select_from_list_name'] = '{}{}'.format(list_prefix, formatted_region_name)
                survey[group_index]['relevant'] = "${{{nation_question}}} = '{nation}'".format(nation_question=NATION_QUESTION_NAME, nation=formatted_region_name)
                # Keep track of this so that we can add in missing regions
                csv_nations.remove(formatted_region_name)
        group_index += 1
        question = survey[group_index]
    
    for remaining_nation in csv_nations:
        site_question = create_nation_type_question(name_prefix, list_prefix, remaining_nation, languages)
        survey.insert(group_index, site_question)
    
    return survey

def modify_group(org_data: dict, asset_survey: list, group: dict, languages: list, name_prefix: str, list_prefix: str) -> dict:
    survey = deepcopy(asset_survey)
    if list_prefix in NATION_AFFIX_LIST_NAMES:
        return modify_nation_group(org_data, survey, group, languages, name_prefix, list_prefix)
    
    group_index = survey.index(group)
    question = survey[group_index]
    
    has_select_one_question = False
    while (question.get('type', '') != 'end_group'):
        question_name = question.get('name', '')
        if PLACEHOLDER_QUESTION in question_name or PLACEHOLDER_QUESTION in question.get('$autoname', ''):
            survey.remove(question)
            question = survey[group_index]
            continue
        if question_name[:len(name_prefix)] == name_prefix:
            survey[group_index]['select_from_list_name'] = '{}'.format(list_prefix)
            has_select_one_question = True

        group_index += 1
        question = survey[group_index]
    
    if not has_select_one_question:
        select_one_question = create_select_one_type_question(name_prefix, list_prefix, languages)
        survey.insert(group_index, select_one_question)

    return survey

def modify_survey_questions_and_choices(asset: Asset, org_data: dict) -> None:
    try:
        asset_survey = asset.content['survey']
    except (KeyError):
        raise KeyError('Asset does not have a survey key')

    group_prefix_map = {
        NATION_GROUP_NAME: {
            'name_prefix': REGION_NAME_PREFIX,
            'list_prefix': REGION_LIST_PREFIX,
            'org_data_key': 'planting_sites'
        },
        FOREST_TYPES_BY_NATION_GROUP_NAME: {
            'name_prefix': FOREST_TYPE_BY_NATION_NAME_PREFIX,
            'list_prefix': FOREST_TYPE_BY_NATION_LIST_PREFIX,
            'org_data_key': 'forest_types',
        },
        FOREST_TYPES_BY_ORG_GROUP_NAME: {
            'name_prefix': FOREST_TYPE_BY_ORG_NAME_PREFIX,
            'list_prefix': FOREST_TYPE_BY_ORG_LIST_PREFIX,
            'org_data_key': 'forest_types'
        }
    }
    # Start off new choices with all the unaffected choices, by basically grabbing all the cho
    choice_list_prefixes_to_exclude = [x['list_prefix'] for x in group_prefix_map.values()] + [NATION_LIST_NAME]
    new_choices = get_unaffected_choices(asset.content['choices'], choice_list_prefixes_to_exclude)
    
    groups = list(filter(lambda question: (
            question.get('type', '') == 'begin_group' and
            question.get('name', '_') in group_prefix_map), asset_survey))

    if len([group for group in groups if group['name'] in group_prefix_map and group['name'] in REQUIRES_NATION_LIST]):
        new_choices += generate_nation_choices(org_data, asset.summary['languages'])

    for question_block_name, values in group_prefix_map.items():
        question_block_groups = [group for group in groups if group['name'] == question_block_name]
        if len(question_block_groups):
            new_choices += generate_choices_for_group(org_data, asset.summary['languages'],
                                                    values['list_prefix'], values['org_data_key'])

        for group in question_block_groups:
            asset_survey = modify_group(org_data, asset_survey, group, asset.summary['languages'], 
                                        values['name_prefix'], values['list_prefix'])
            
    with transaction.atomic():
        asset.content['survey'] = asset_survey
        asset.content['choices'] = new_choices
        # asset.content['survey'] = new_survey
        asset.save()