from copy import deepcopy

from django.db import transaction
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist

from kpi.models import Asset

from veritree.models import VeritreeOAuth2
from veritree.question_blocks.get_org_data_functions import (
    get_org_forest_species_types, get_org_planting_site_and_region_data
)
from veritree.question_blocks.create_choices import (
    generate_choices_for_group, generate_nation_choices, get_unaffected_choices
)
from veritree.question_blocks.create_questions import (
    create_amount_planted_question, create_nation_type_question, create_select_one_type_question
)
from veritree.question_blocks.utils import format_question_name, unformat_question_name
from veritree.question_blocks.constants import *

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
    forest_type_species = get_org_forest_species_types(veritree_access_token, veritree_org_id)
    # TODO: Return a status code???
    modify_survey_questions_and_choices(asset, region_and_planting_data, forest_type_species)
    return True



def modify_nation_group(org_data: dict, survey: list, group: dict, languages: "list[str]", name_prefix: str, list_prefix: str):
    group_index = survey.index(group)
    question = survey[group_index]
    csv_nations = [format_question_name(nation) for nation in org_data.keys()]
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

def modify_amount_planted_group(forest_type_species_data: dict, survey: list, group: dict, languages: list, name_prefix: str, list_prefix: str):
    group_index = survey.index(group)
    question = survey[group_index]
    species = [format_question_name(species) for species in forest_type_species_data.keys()]
    while (question.get('type', '') != 'end_group'):
        question_name = question.get('name', '')
        if question_name[:len(name_prefix)] == name_prefix:
            formatted_species_name = question_name[len(name_prefix):]
            if question_name[len(name_prefix):] in species:
                species.remove(formatted_species_name)            
        group_index += 1
        question = survey[group_index]

    for specie_label in species:
        forest_type = forest_type_species_data.get(unformat_question_name(specie_label), None)
        amount_planted_question = create_amount_planted_question(specie_label, name_prefix, forest_type, languages)
        survey.insert(group_index, amount_planted_question)

    return survey

def modify_group(org_data: dict, forest_type_species: dict, asset_survey: list, group: dict,
                 languages: list, name_prefix: str, list_prefix: str) -> dict:
    survey = deepcopy(asset_survey)
    if list_prefix in NATION_AFFIX_LIST_NAMES:
        return modify_nation_group(org_data, survey, group, languages, name_prefix, list_prefix)
    
    if list_prefix == FOREST_TYPE_AND_SPECIES_BY_ORG_LIST_PREFIX:
        return modify_amount_planted_group(forest_type_species, survey, group, languages, name_prefix, list_prefix)
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

def modify_survey_questions_and_choices(asset: Asset, org_data: dict, forest_type_species: dict) -> None:
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
        },
        FOREST_TYPES_SPECIES_BY_ORG_GROUP_NAME: {
            'name_prefix': FOREST_TYPE_AND_SPECIES_BY_ORG_NAME_PREFIX,
            'list_prefix': FOREST_TYPE_AND_SPECIES_BY_ORG_LIST_PREFIX,
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
            if 'org_data_key' in values:
                new_choices += generate_choices_for_group(org_data, asset.summary['languages'],
                                                    values['list_prefix'], values['org_data_key'])

        for group in question_block_groups:
            asset_survey = modify_group(org_data, forest_type_species, asset_survey, group, asset.summary['languages'], 
                                        values['name_prefix'], values['list_prefix'])
            
    with transaction.atomic():
        asset.content['survey'] = asset_survey
        asset.content['choices'] = new_choices
        # asset.content['survey'] = new_survey
        asset.save()