# -*- coding: utf-8 -*-
"""
pyxform is a Python library designed to make authoring XForms for ODK
Collect easy.
"""

__version__ = "0.15.1"

from pyxform.builder import (
    SurveyElementBuilder,
    create_survey,
    create_survey_element_from_dict,
    create_survey_from_path,
    create_survey_from_xls,
)
from pyxform.instance import SurveyInstance
from pyxform.question import InputQuestion, MultipleChoiceQuestion, Question
from pyxform.question_type_dictionary import QUESTION_TYPE_DICT
from pyxform.section import Section
from pyxform.survey import Survey
from pyxform.xls2json import SurveyReader as ExcelSurveyReader

# This is what gets imported when someone imports pyxform
# flake8: noqa
