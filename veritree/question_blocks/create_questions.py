from veritree.question_blocks.constants import *
from veritree.question_blocks.utils import format_question_name

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

def create_amount_planted_question(species_label, name_prefix, forest_type, languages):
    question = {
        'type': 'integer',
        'label': [f"{species_label.replace('_', ' ')}" for language in languages],
        'name': f"{name_prefix}{format_question_name(species_label)}"
    }
    if forest_type and forest_type['forest_type']: # Bad nesting
        question['relevant'] = f"${{{FOREST_TYPE_BY_ORG_NAME_PREFIX}}} = '{format_question_name(forest_type['forest_type'])}' and ${{{enter_by_question}}} = '{by_species_option}'"

    return question