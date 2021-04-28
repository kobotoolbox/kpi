# -*- coding: utf-8 -*-
"""
Translator class module.
"""
from collections import defaultdict


def infinite_dict():
    return defaultdict(infinite_dict)


# The big idea with this class structure is I want to do the
# following:
# translator = Translator()
# translator.add_translation(...)
# translator.translate('How are you?').from('English').to('French')


class _StringWithLanguageTranslator(object):
    def __init__(self, dictionary):
        self._dict = dictionary

    def to_language(self, language):
        if language in self._dict:
            return self._dict[language]
        return None


class _StringTranslator(object):
    def __init__(self, dictionary):
        self._dict = dictionary

    def from_language(self, language):
        dictionary = self._dict[language]
        return _StringWithLanguageTranslator(dictionary)


class Translator(object):
    def __init__(self):
        """
        I'm being super lazy dictionary has to have the form:
        {'yes' : {'English' : {'French' : 'oui'}}}
        """
        self._dict = infinite_dict()
        self._languages = []

    def add_translation(
        self, string, source_language, destination_language, translated_string
    ):
        for lang in [source_language, destination_language]:
            if lang not in self._languages:
                self._languages.append(lang)
        self._dict[string][source_language][destination_language] = translated_string

    def translate(self, string):
        dictionary = self._dict[string]
        return _StringTranslator(dictionary)

    def to_json_dict(self):
        return self._dict


# code used to construct a translator from the excel files from phase II.
# import glob, os
# from xls2json import ExcelReader, print_pyobj_to_json
# from translator import Translator

# translator = Translator()

# def add_dict(d):
#     keys = d.keys()
#     keys.remove(u"English")
#     for key in keys:
#         yield {u"string" : d[u"English"],
#                u"source_language" : u"English",
#                u"destination_language" : key,
#                u"translated_string" : d[key]}

# def add_row(d):
#     assert type(d)==dict, str(d)
#     for k, v in d.items():
#         if type(v)==dict and u"English" in v.keys():
#             for result in add_dict(v): yield result

# xls_files = glob.glob( os.path.join("translators", "*", "*.xls") )
# all_translations = []
# for xls_file in xls_files:
#     excel_reader = ExcelReader(xls_file)
#     for sheet_name, list_of_dicts in excel_reader.to_json_dict().items():
#         for d in list_of_dicts:
#             for result in add_row(d):
#                 translator.add_translation(**result)
# print_pyobj_to_json(translator.to_json_dict(), "nigeria.json")
