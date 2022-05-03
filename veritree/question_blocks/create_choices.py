from veritree.question_blocks.utils import format_question_name
from veritree.question_blocks.constants import *

def generate_choices_for_group_from_general_org_data(org_data: dict, languages: "list[str]", list_prefix: str, org_data_key: str):
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
                    'name': format_question_name(org_data_value),
                    'label': [org_data_value for _ in languages],
                    'list_name': '{}{}'.format(list_prefix, format_question_name(nation)) 
                }
            else:
                new_choice = {
                    'name': format_question_name(org_data_value),
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
            'name': format_question_name(nation),
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

def generate_sponsor_choices(sponsor_dict: dict, languages: "list[str]"):
    new_choices = []
    for sponsor in sponsor_dict.keys():
        new_choices.append({
            'name': format_question_name(sponsor),
            'label': [sponsor for _ in languages],
            'list_name': '{}'.format(SPONSORS_BY_ORG_LIST_PREFIX)
        })
    return new_choices