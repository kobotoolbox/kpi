# coding: utf-8
'''
this util parses the string of known_cols saved in the db
and builds the structure that formpack expects to see in the
asset.analysis_form_json()

input is an array of strings that look like this:
  - q1:transcr:en
  - q1:translt:fr
  - q1:translt:de

output is a more descriptive structure. (See test_parse_knowncols)
'''
from collections import defaultdict


def parse_field_cols(qpath, fieldcols):
    fcx = {'tsc': [], 'tsl': []}
    for fc in fieldcols:
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
    # name does not address questions in groups
    name = qpath.split('-')[-1]
    if len(langs['tsc']) > 0:
        for lang in langs['tsc']:
            out.append({
                'type': 'transcript',
                'name': f'{name}/transcript_{lang}',
                'dtpath': f'{qpath}/transcript_{lang}',
                'label': f'{name} - transcript',
                'language': lang,
                'qpath': f'{name}-transcript-{lang}',
                'source': qpath,
                'path': [*qpath.split('-'), 'transcript'],
                'settings': {'mode': 'manual', 'engine':'engines/transcript_manual'},
            })
    if len(langs['tsl']) > 0:
        for lang in langs['tsl']:
            out.append({
                'type': 'translation',
                'name': f'{name}/translation_{lang}',
                'dtpath': f'{qpath}/translation_{lang}',
                'label': f'{name} - translation',
                'language': lang,
                'qpath': f'{name}-translation-{lang}',
                'source': qpath,
                'path': [*qpath.split('-'), 'translation'],
                'settings': {'mode': 'manual', 'engine':'engines/translation_manual'},
            })
    return out


def parse_knowncols(knownc):
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
