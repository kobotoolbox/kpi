# coding: utf-8
'''
this util has 2 functions that serve to parse the submission_extras
for an asset and build a list of extra columns that should be included
in exports.

 - determine_export_cols_indiv() # iterates through the cols for an individ subm_extra.content
 - determine_export_cols_with_values() #

input is an array of strings that look like this:
  - q1:transcr:en
  - q1:translt:fr
  - q1:translt:de

output is a more descriptive structure. (See test_parse_knowncols)
'''


KEY_TYPE_DICTS = {
    'googlets': 'autotranscript_google',
    'googletx': 'autotranslate_google',
    'transcript': 'manual_transcript',
    'translated': 'manual_translation',
}


def is_non_null_submext_data(key, tvals):
    return True


def get_lang_code(key, tvals):
    if 'languageCode' in tvals:
        yield tvals['languageCode']
    elif key == 'translated':
        for key in tvals.keys():
            yield key
    else:
        # why
        return None


def determine_export_cols_indiv(sub_ex_content):
    '''
    used primarily in subsequences.models,
    also used by runscript, called from determine_export_cols_with_values, below
    '''
    for qpath in sub_ex_content.keys():
        for key in sub_ex_content[qpath].keys():
            tvals = sub_ex_content[qpath][key]
            if not is_non_null_submext_data(key, tvals):
                continue
            dtype = key
            if key in KEY_TYPE_DICTS:
                dtype = KEY_TYPE_DICTS[key]
            col_string = f'{qpath}:{dtype}'
            has_lang = None
            for lang_code in get_lang_code(key, tvals):
                if lang_code is None:
                    raise ValueError('Should not get here')
                has_lang = True
                yield f'{col_string}:{lang_code}'
            if not has_lang:
                yield col_string


def determine_export_cols_with_values(asset_submission_extras_all):
    '''
    used in management command <repop_known_cols>
    to rebuild asset.known_cols
    '''
    col_strings = []
    for sub_ex in asset_submission_extras_all:
        for col_string in determine_export_cols_indiv(sub_ex.content):
            if col_string not in col_strings:
                col_strings.append(col_string)
    return col_strings
