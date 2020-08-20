import copy
import yaml

from jsonschema.exceptions import ValidationError

from a1d05eba1 import BaseContent
from a1d05eba1.exceptions import ContentValidationError
from a1d05eba1.content_variations import VARIATIONS, X_Content
from a1d05eba1.transformations.transformer import Transformer
from a1d05eba1.transformations import (
    AnchorsFromNameOrRandom,
    RenameKuidToAnchor,
    ReplaceTruthyStrings,
    XlsformTranslations,
    ChoicesByListNameRW,
    EnsureTranslationListRW,
    FillMissingLabelsRW,
    RemoveEmptiesRW,
    UnwrapSettingsFromListRW,
    V1RenamesRW,
    XlsformChoicesRW,
)

KOBOXLSFORM_SCHEMA = copy.deepcopy(VARIATIONS['V1_Kuid_Content'].input_schema)
KOBOXLSFORM_SCHEMA['properties']['survey']['items']['required'] = []

class Autoname(Transformer):
    def rw__each_row(self, row):
        if 'name' not in row and '$autoname' in row:
            return row.renamed('$autoname', 'name')
        return row

    def rw__each_choice(self, choice, list_name):
        if 'name' in choice and 'value' not in choice:
            choice = choice.renamed('name', 'value')
        if 'value' not in choice and '$autovalue' in choice:
            choice = choice.renamed('$autovalue', 'value')
        return choice

class KoboContent(BaseContent):
    '''
    KoboContent matches any content agianst the primary JSON schema for future
    Asset.content variations
    '''
    schema_string = '2'
    transformers = (
        AnchorsFromNameOrRandom,
        FillMissingLabelsRW,
        Autoname,
    )

class KoboContentV1(BaseContent):
    '''
    KoboContentV1 should match and convert any content that has been saved in
    Asset.content with "schema"="1" since kpi commit #5853f1cc81
    '''
    schema_string = '1'
    input_schema = KOBOXLSFORM_SCHEMA

    transformers = (
        UnwrapSettingsFromListRW,
        RemoveEmptiesRW,
        XlsformChoicesRW,
        RenameKuidToAnchor,
        AnchorsFromNameOrRandom,
        ReplaceTruthyStrings,
        V1RenamesRW,
        EnsureTranslationListRW,
        FillMissingLabelsRW,
        Autoname,
    )

class KoboFormBuilderContent(BaseContent):
    from_schema_string = 'formbuilder'
    schema_string = '1'
    transformers = (
        UnwrapSettingsFromListRW,
        ChoicesByListNameRW,
        XlsformTranslations,
        RemoveEmptiesRW,
        XlsformChoicesRW,
        RenameKuidToAnchor,
        AnchorsFromNameOrRandom,
        ReplaceTruthyStrings,
        V1RenamesRW,
        EnsureTranslationListRW,
        FillMissingLabelsRW,
        Autoname,
    )

class XlsformContent(X_Content):
    from_schema_string = 'xlsform'
    schema_string = '1'

_EMPTY_CONTENT = KoboContent({'survey':tuple(), 'choices': {}, 'schema':'2'}).export()

def empty_content():
    return copy.deepcopy(_EMPTY_CONTENT)

def xlsform_content(content):
    return XlsformContent({**content, 'schema': 'xlsform'})

def get_content_object(content):
    for Kls in [KoboFormBuilderContent, KoboContentV1]:
        try:
            return Kls(content, validate=True)
        except (ContentValidationError, ValidationError, AssertionError) as err:
            continue
    return KoboContent(content, validate=True)
