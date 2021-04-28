# -*- coding: utf-8 -*-
"""
ExternalInstance class module
"""
from pyxform.survey_element import SurveyElement


class ExternalInstance(SurveyElement):
    def xml_control(self):
        """
        No-op since there is no associated form control to place under <body/>.

        Exists here because there's a soft abstractmethod in SurveyElement.
        """
        pass
