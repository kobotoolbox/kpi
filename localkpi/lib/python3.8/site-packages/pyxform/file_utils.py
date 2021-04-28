# -*- coding: utf-8 -*-
"""
The pyxform file utility functions.
"""
import glob
import os

from pyxform import utils
from pyxform.xls2json import SurveyReader


def _section_name(path_or_file_name):
    directory, filename = os.path.split(path_or_file_name)
    section_name, extension = os.path.splitext(filename)
    return section_name


def load_file_to_dict(path):
    """
    Takes a file path and loads it into a nested json dict
    following the format in json_form_schema.json
    The file may be a xls file or json file.
    If it is xls it is converted using xls2json.
    """
    if path.endswith(".json"):
        name = _section_name(path)
        return name, utils.get_pyobj_from_json(path)
    else:
        name = _section_name(path)
        excel_reader = SurveyReader(path)
        return name, excel_reader.to_json_dict()


def collect_compatible_files_in_directory(directory):
    """
    create a giant dict out of all the spreadsheets and json forms
    in the given directory
    """
    available_files = glob.glob(os.path.join(directory, "*.xls")) + glob.glob(
        os.path.join(directory, "*.json")
    )

    return dict([load_file_to_dict(f) for f in available_files])
