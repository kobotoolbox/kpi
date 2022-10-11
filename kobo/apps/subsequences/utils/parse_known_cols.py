# coding: utf-8
'''
this util parses the string of known_cols saved in the db
and builds the structure that formpack expects to see in the
asset.analysis_form_json()

input is an array of strings that look like this:
  - q1:transcr:en
  - q1:translt:fr
  - q1:translt:de

output is a more descriptive structure. (See test_parse_known_cols)
'''
from collections import defaultdict


def extend_col_deets(lang, coltype, label, q_path):
    name = q_path.split('-')[-1]
    out = {'label': name, 'name': name}
    out['dtpath'] = f'{q_path}/{coltype}_{lang}'
    out['type'] = coltype
    out['language'] = lang
    out['label'] = f'{label} - {coltype}'
    out['name'] = f'{name}/{coltype}_{lang}'
    out['source'] = q_path
    out['qpath'] = f'{name}-{coltype}-{lang}'
    out['settings'] = {'mode': 'manual', 'engine': f'engines/{coltype}_manual'}
    out['path'] = [q_path, coltype]
    return out


def parse_field_cols(qpath, fieldcols):
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
            out.append(extend_col_deets(lang=lang, label=qpath.split('-')[-1], q_path=qpath,
                coltype='transcript',
            ))
    if len(langs['tsl']) > 0:
        for lang in langs['tsl']:
            out.append(extend_col_deets(lang=lang, label=qpath.split('-')[-1], q_path=qpath,
                coltype='translation',
            ))
    return out


def parse_known_cols(knownc):
    by_qpath = defaultdict(list)
    out = []
    if isinstance(knownc, dict):
        knownc = knownc.get('known')
    for fieldstr in knownc:
        sects = fieldstr.split(':')
        [qpath, field, *rest] = sects
        item = {'field': field}
        if len(sects) == 3:
            item['tx'] = sects[2]
        by_qpath[qpath].append(item)
    by_qpath_list = []
    for qpath, cols in by_qpath.items():
        by_qpath_list = [*by_qpath_list, *parse_field_cols(qpath, cols)]
    return by_qpath_list
