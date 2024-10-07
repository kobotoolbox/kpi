# coding: utf-8
"""
this util has 2 functions that serve to parse the submission_extras
for an asset and build a list of extra columns that should be included
in exports.

 - determine_export_cols_indiv() # iterates through the cols for an individ subm_extra.content
 - determine_export_cols_with_values() #

input is an array of strings that look like this:
  - q1:transcr:en
  - q1:translt:fr
  - q1:translt:de

output is a more descriptive structure. (See test_parse_known_cols)
"""


KEY_TYPE_DICTS = {
    'googlets': 'transcript_auto_google',
    'googletx': 'translation_auto_google',
}


def get_lang_code(key, tvals):
    if 'languageCode' in tvals:
        yield tvals['languageCode']
    elif key == 'translation':
        for key in tvals.keys():
            yield key
    elif key == 'translated': # migration
        raise ValueError('key "translated" should not be in the asset. Run management command:'
                         ' python manage.py runscript repop_known_cols" to fix')


def determine_export_cols_indiv(sub_ex_content):
    """
    used primarily when a SubmissionExtras object is saved.

    iterates through content to see which questions have
    transcripts/translations that need to end up in the export

    yields strings in this format-
     "<question xpath>:transcript:<lang>"
     "<question xpath>:translation:<lang>"
    """

    for xpath in sub_ex_content.keys():
        for key in sub_ex_content[xpath].keys():
            tvals = sub_ex_content[xpath][key]
            # if not is_non_null_submext_data(key, tvals):
            #     continue
            dtype = KEY_TYPE_DICTS.get(key, key)
            col_string = f'{xpath}:{dtype}'
            for lang_code in get_lang_code(key, tvals):
                yield f'{col_string}:{lang_code}'


def determine_export_cols_with_values(asset_submission_extras_all):
    """
    used in management command <repop_known_cols>
    to rebuild asset.known_cols
    """
    col_strings = tuple()
    for sub_ex in asset_submission_extras_all:
        for col_string in determine_export_cols_indiv(sub_ex.content):
            if col_string not in col_strings:
                col_strings = (*col_strings, col_string)
    return col_strings
