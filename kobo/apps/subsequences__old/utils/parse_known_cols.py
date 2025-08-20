"""
this util parses the string of known_cols saved in the db
and builds the structure that formpack expects to see in the
asset.analysis_form_json()

input is an array of strings that look like this:
  - q1:transcr:en
  - q1:translt:fr
  - q1:translt:de

output is a more descriptive structure. (See test_parse_known_cols)
"""
from collections import defaultdict


def extend_col_deets(lang: str, coltype: str, label: str, xpath: str) -> dict:
    # NB: refer to commit d013bfe0f5 when trying to figure out the original
    # intent here
    out = {
        'dtpath': f'{xpath}/{coltype}_{lang}',
        'type': coltype,
        'language': lang,
        'label': f'{label} - {coltype}',
        'name': f'{xpath}/{coltype}_{lang}',
        'source': xpath,
        'xpath': f'{xpath}/{coltype}/{lang}',
        'settings': {'mode': 'manual', 'engine': f'engines/{coltype}_manual'},
        'path': [xpath, coltype],
    }
    return out


def parse_field_cols(xpath, fieldcols):
    fcx = {'tsc': [], 'tsl': []}
    for fc in fieldcols:
        if 'tx' not in fc:
            continue
        if 'transl' in fc['field']:
            fcx['tsl'].append(fc)
        elif 'transc' in fc['field']:
            fcx['tsc'].append(fc)

    langs = {}
    for categ in ['tsc', 'tsl']:
        langs[categ] = []
        for col in fcx[categ]:
            tx = col['tx']
            if tx not in langs[categ]:
                langs[categ].append(tx)
    out = []

    if len(langs['tsc']) > 0:
        for lang in langs['tsc']:
            out.append(
                extend_col_deets(
                    lang=lang,
                    label=xpath.split('/')[-1],
                    xpath=xpath,
                    coltype='transcript',
                )
            )
    if len(langs['tsl']) > 0:
        for lang in langs['tsl']:
            out.append(
                extend_col_deets(
                    lang=lang,
                    label=xpath.split('/')[-1],
                    xpath=xpath,
                    coltype='translation',
                )
            )
    return out


def parse_known_cols(known_columns):
    by_xpath = defaultdict(list)
    if isinstance(known_columns, dict):
        known_columns = known_columns.get('known')
    for fieldstr in known_columns:
        sects = fieldstr.split(':')
        [xpath, field, *_] = sects
        item = {'field': field}
        if len(sects) == 3:
            item['tx'] = sects[2]
        by_xpath[xpath].append(item)
    by_xpath_list = []
    for xpath, cols in by_xpath.items():
        by_xpath_list = [*by_xpath_list, *parse_field_cols(xpath, cols)]
    return by_xpath_list
