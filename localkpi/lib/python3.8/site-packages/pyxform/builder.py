# -*- coding: utf-8 -*-
"""
Survey builder functionality.
"""
import copy
import os

from pyxform import file_utils, utils
from pyxform.errors import PyXFormError
from pyxform.external_instance import ExternalInstance
from pyxform.question import (
    InputQuestion,
    MultipleChoiceQuestion,
    OsmUploadQuestion,
    Question,
    RangeQuestion,
    TriggerQuestion,
    UploadQuestion,
)
from pyxform.question_type_dictionary import QUESTION_TYPE_DICT
from pyxform.section import GroupedSection, RepeatingSection
from pyxform.survey import Survey
from pyxform.utils import unicode
from pyxform.xls2json import SurveyReader


def copy_json_dict(json_dict):
    """
    Returns a deep copy of the input json_dict
    """
    json_dict_copy = None
    items = None

    if type(json_dict) is list:
        json_dict_copy = [None] * len(json_dict)
        items = enumerate(json_dict)
    elif type(json_dict) is dict:
        json_dict_copy = {}
        items = json_dict.items()

    for key, value in items:
        if type(value) is dict or type(value) is list:
            json_dict_copy[key] = copy_json_dict(value)
        else:
            json_dict_copy[key] = value

    return json_dict_copy


class SurveyElementBuilder(object):
    # we use this CLASSES dict to create questions from dictionaries
    QUESTION_CLASSES = {
        "": Question,
        "action": Question,
        "input": InputQuestion,
        "odk:rank": MultipleChoiceQuestion,
        "osm": OsmUploadQuestion,
        "range": RangeQuestion,
        "select": MultipleChoiceQuestion,
        "select1": MultipleChoiceQuestion,
        "trigger": TriggerQuestion,
        "upload": UploadQuestion,
    }

    SECTION_CLASSES = {
        "group": GroupedSection,
        "repeat": RepeatingSection,
        "survey": Survey,
    }

    def __init__(self, **kwargs):
        # I don't know why we would need an explicit none option for
        # select alls
        self._add_none_option = False
        self.set_sections(kwargs.get("sections", {}))

    def set_sections(self, sections):
        """
        sections is a dict of python objects, a key in this dict is
        the name of the section and the value is a dict that can be
        used to create a whole survey.
        """
        assert type(sections) == dict
        self._sections = sections

    def create_survey_element_from_dict(self, d):
        """
        Convert from a nested python dictionary/array structure (a json dict I
        call it because it corresponds directly with a json object)
        to a survey object
        """
        if "add_none_option" in d:
            self._add_none_option = d["add_none_option"]
        if d["type"] in self.SECTION_CLASSES:
            return self._create_section_from_dict(d)
        elif d["type"] == "loop":
            return self._create_loop_from_dict(d)
        elif d["type"] == "include":
            section_name = d["name"]
            if section_name not in self._sections:
                raise PyXFormError(
                    "This section has not been included.",
                    section_name,
                    self._sections.keys(),
                )
            d = self._sections[section_name]
            full_survey = self.create_survey_element_from_dict(d)
            return full_survey.children
        elif d["type"] == "xml-external":
            return ExternalInstance(**d)
        else:
            return self._create_question_from_dict(
                d, copy_json_dict(QUESTION_TYPE_DICT), self._add_none_option
            )

    @staticmethod
    def _create_question_from_dict(d, question_type_dictionary, add_none_option=False):
        question_type_str = d["type"]
        d_copy = d.copy()

        # TODO: Keep add none option?
        if add_none_option and question_type_str.startswith("select all that apply"):
            SurveyElementBuilder._add_none_option_to_select_all_that_apply(d_copy)

        # Handle or_other on select type questions
        or_other_str = " or specify other"
        if question_type_str.endswith(or_other_str):
            question_type_str = question_type_str[
                : len(question_type_str) - len(or_other_str)
            ]
            d_copy["type"] = question_type_str
            SurveyElementBuilder._add_other_option_to_multiple_choice_question(d_copy)
            return [
                SurveyElementBuilder._create_question_from_dict(
                    d_copy, question_type_dictionary, add_none_option
                ),
                SurveyElementBuilder._create_specify_other_question_from_dict(d_copy),
            ]

        question_class = SurveyElementBuilder._get_question_class(
            question_type_str, question_type_dictionary
        )

        # todo: clean up this spaghetti code
        d_copy["question_type_dictionary"] = question_type_dictionary
        if question_class:

            return question_class(**d_copy)

        return []

    @staticmethod
    def _add_other_option_to_multiple_choice_question(d):
        # ideally, we'd just be pulling from children
        choice_list = d.get("choices", d.get("children", []))
        if len(choice_list) <= 0:
            raise PyXFormError("There should be choices for this question.")
        other_choice = {"name": "other", "label": "Other"}
        if other_choice not in choice_list:
            choice_list.append(other_choice)

    @staticmethod
    def _add_none_option_to_select_all_that_apply(d_copy):
        choice_list = d_copy.get("choices", d_copy.get("children", []))
        if len(choice_list) <= 0:
            raise PyXFormError("There should be choices for this question.")
        none_choice = {"name": "none", "label": "None"}
        if none_choice not in choice_list:
            choice_list.append(none_choice)
            none_constraint = "(.='none' or not(selected(., 'none')))"
            if "bind" not in d_copy:
                d_copy["bind"] = {}
            if "constraint" in d_copy["bind"]:
                d_copy["bind"]["constraint"] += " and " + none_constraint
            else:
                d_copy["bind"]["constraint"] = none_constraint

    @staticmethod
    def _get_question_class(question_type_str, question_type_dictionary):
        """
        Read the type string from the json format,
        and find what class it maps to going through
        type_dictionary -> QUESTION_CLASSES
        """
        question_type = question_type_dictionary.get(question_type_str, {})
        control_dict = question_type.get("control", {})
        control_tag = control_dict.get("tag", "")
        if control_tag == "upload" and control_dict.get("mediatype") == "osm/*":
            control_tag = "osm"

        return SurveyElementBuilder.QUESTION_CLASSES[control_tag]

    @staticmethod
    def _create_specify_other_question_from_dict(d):
        kwargs = {
            "type": "text",
            "name": "%s_other" % d["name"],
            "label": "Specify other.",
            "bind": {"relevant": "selected(../%s, 'other')" % d["name"]},
        }
        return InputQuestion(**kwargs)

    def _create_section_from_dict(self, d):
        d_copy = d.copy()
        children = d_copy.pop("children", [])
        section_class = self.SECTION_CLASSES[d_copy["type"]]
        if d["type"] == "survey" and "title" not in d:
            d_copy["title"] = d["name"]
        result = section_class(**d_copy)
        for child in children:
            # Deep copying the child is a hacky solution to the or_other bug.
            # I don't know why it works.
            # And I hope it doesn't break something else.
            # I think the good solution would be to rewrite this class.
            survey_element = self.create_survey_element_from_dict(copy.deepcopy(child))
            if survey_element:
                result.add_children(survey_element)

        return result

    def _create_loop_from_dict(self, d):
        """
        Takes a json_dict of "loop" type
        Returns a GroupedSection
        """
        d_copy = d.copy()
        children = d_copy.pop("children", [])
        columns = d_copy.pop("columns", [])
        result = GroupedSection(**d_copy)

        # columns is a left over from when this was
        # create_table_from_dict, I will need to clean this up
        for column_dict in columns:
            # If this is a none option for a select all that apply
            # question then we should skip adding it to the result
            if column_dict["name"] == "none":
                continue

            column = GroupedSection(**column_dict)
            for child in children:
                question_dict = self._name_and_label_substitutions(child, column_dict)
                question = self.create_survey_element_from_dict(question_dict)
                column.add_child(question)
            result.add_child(column)
        if result.name != "":
            return result

        # TODO: Verify that nothing breaks if this returns a list
        return result.children

    def _name_and_label_substitutions(self, question_template, column_headers):
        # if the label in column_headers has multiple languages setup a
        # dictionary by language to do substitutions.
        info_by_lang = {}
        if type(column_headers["label"]) == dict:
            info_by_lang = dict(
                [
                    (
                        lang,
                        {
                            "name": column_headers["name"],
                            "label": column_headers["label"][lang],
                        },
                    )
                    for lang in column_headers["label"].keys()
                ]
            )

        result = question_template.copy()
        for key in result.keys():
            if type(result[key]) == unicode:
                result[key] %= column_headers
            elif type(result[key]) == dict:
                result[key] = result[key].copy()
                for key2 in result[key].keys():
                    if type(column_headers["label"]) == dict:
                        result[key][key2] %= info_by_lang.get(key2, column_headers)
                    else:
                        result[key][key2] %= column_headers
        return result

    def create_survey_element_from_json(self, str_or_path):
        d = utils.get_pyobj_from_json(str_or_path)
        return self.create_survey_element_from_dict(d)


def create_survey_element_from_dict(d, sections=None):
    """
    Creates a Survey from a dictionary in the format provided by SurveyReader
    """
    if sections is None:
        sections = {}
    builder = SurveyElementBuilder()
    builder.set_sections(sections)
    return builder.create_survey_element_from_dict(d)


def create_survey_element_from_json(str_or_path):
    d = utils.get_pyobj_from_json(str_or_path)
    return create_survey_element_from_dict(d)


def create_survey_from_xls(path_or_file):
    excel_reader = SurveyReader(path_or_file)
    d = excel_reader.to_json_dict()
    survey = create_survey_element_from_dict(d)
    if not survey.id_string:
        survey.id_string = excel_reader._name
    return survey


def create_survey(
    name_of_main_section=None,
    sections=None,
    main_section=None,
    id_string=None,
    title=None,
    default_language=None,
):
    """
    name_of_main_section -- a string key used to find the main section in the
                            sections dict if it is not supplied in the
                            main_section arg
    main_section -- a json dict that represents a survey
    sections -- a dictionary of sections that can be drawn from to build the
                survey
    This function uses the builder class to create and return a survey.
    """
    if sections is None:
        sections = {}
    if main_section is None:
        main_section = sections[name_of_main_section]
    builder = SurveyElementBuilder()
    builder.set_sections(sections)

    # assert name_of_main_section in sections, name_of_main_section
    if "id_string" not in main_section:
        main_section["id_string"] = (
            name_of_main_section if id_string is None else name_of_main_section
        )
    survey = builder.create_survey_element_from_dict(main_section)

    # not sure where to do this without repeating ourselves,
    # but it's needed to pass xls2xform tests
    # TODO: I would assume that the json-dict is valid
    # (i.e. that it has a id string), then throw an error here.
    #        We can set the id to whatever we want in xls2json.
    #        Although to be totally modular, maybe we do need to repeat a lot
    #       of the validation and setting default value stuff from xls2json
    if id_string is not None:
        survey.id_string = id_string

    if title is not None:
        survey.title = title
    survey.def_lang = default_language

    return survey


def create_survey_from_path(path, include_directory=False):
    """
    include_directory -- Switch to indicate that all the survey forms in the
                         same directory as the specified file should be read
                         so they can be included through include types.
    @see: create_survey
    """
    directory, file_name = os.path.split(path)
    if include_directory:
        main_section_name = file_utils._section_name(file_name)
        sections = file_utils.collect_compatible_files_in_directory(directory)
    else:
        main_section_name, section = file_utils.load_file_to_dict(path)
        sections = {main_section_name: section}
    pkg = {"name_of_main_section": main_section_name, "sections": sections}

    return create_survey(**pkg)
