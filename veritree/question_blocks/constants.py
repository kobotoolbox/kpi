# Constants

# Question Block Group Names
NATION_GROUP_NAME = 'group_nations' # It seems to be the case that the word after group_ has to be 7 characters long in order to properly save with kobo
FOREST_TYPES_BY_NATION_GROUP_NAME = 'group_forestN'
FOREST_TYPES_BY_ORG_GROUP_NAME = 'group_forestO'
FOREST_TYPES_SPECIES_BY_ORG_GROUP_NAME = 'group_amountO'

# Nation and Planting Site Block
NATION_QUESTION_NAME = 'Project_Nation'
NATION_LIST_NAME = 'Project_Nation_'
REGION_LIST_PREFIX = 'Region_'
REGION_NAME_PREFIX = 'Choose_Planting_Site_'
planting_site_question = 'Choose_Planting_Site'

# Forest Type by Nation Block
FOREST_TYPE_BY_NATION_LIST_PREFIX = 'Forest_Type_Nation_'
FOREST_TYPE_BY_NATION_NAME_PREFIX = 'Choose_Forest_Type_'

# Forest Type by Org Block
FOREST_TYPE_BY_ORG_LIST_PREFIX = 'Forest_Type_Org'
FOREST_TYPE_BY_ORG_NAME_PREFIX = 'Choose_Forest_Type'

# Species and Amount planted Block ( goes with the forest_type by org block )
FOREST_TYPE_AND_SPECIES_BY_ORG_LIST_PREFIX = 'Forest_Type_Species_Planted_Org'
FOREST_TYPE_AND_SPECIES_BY_ORG_NAME_PREFIX = 'amount_planted_'
amount_planted_question = 'amount_planted'
enter_by_question = 'planted_by'
by_species_option = 'by_species'

# Misc Constants
PLACEHOLDER_QUESTION = 'placeholder'

# Nation dependent constants ( used for skip logic when a certain nation is selected )
NATION_AFFIX_LIST_NAMES = [REGION_LIST_PREFIX, FOREST_TYPE_BY_NATION_LIST_PREFIX]
REQUIRES_NATION_LIST = [NATION_GROUP_NAME, FOREST_TYPES_BY_NATION_GROUP_NAME]
