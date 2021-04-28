# -*- coding: utf-8 -*-
"""
Testing the instance object for pyxform.
"""
from unittest import TestCase

from pyxform import Survey, SurveyInstance
from pyxform.builder import create_survey_element_from_dict
from pyxform.tests.utils import prep_class_config


class Json2XformExportingPrepTests(TestCase):
    @classmethod
    def setUpClass(cls):
        prep_class_config(cls=cls)

    def test_simple_survey_instantiation(self):
        surv = Survey(name="Simple")
        q = create_survey_element_from_dict(
            {"type": "text", "name": "survey_question", "label": "Question"}
        )
        surv.add_child(q)

        i = surv.instantiate()

        self.assertEquals(i.keys(), ["survey_question"])
        self.assertEquals(set(i.xpaths()), {"/Simple", "/Simple/survey_question"})

    def test_simple_survey_answering(self):
        surv = Survey(name="Water")
        q = create_survey_element_from_dict(
            {"type": "text", "name": "color", "label": "Color"}
        )
        q2 = create_survey_element_from_dict(
            {"type": "text", "name": "feeling", "label": "Feeling"}
        )

        surv.add_child(q)
        surv.add_child(q2)
        i = SurveyInstance(surv)

        i.answer(name="color", value="blue")
        self.assertEquals(i.answers()["color"], "blue")

        i.answer(name="feeling", value="liquidy")
        self.assertEquals(i.answers()["feeling"], "liquidy")

    def test_answers_can_be_imported_from_xml(self):
        surv = Survey(name="data")

        surv.add_child(
            create_survey_element_from_dict(
                {"type": "text", "name": "name", "label": "Name"}
            )
        )
        surv.add_child(
            create_survey_element_from_dict(
                {
                    "type": "integer",
                    "name": "users_per_month",
                    "label": "Users per month",
                }
            )
        )
        surv.add_child(
            create_survey_element_from_dict(
                {"type": "gps", "name": "geopoint", "label": "gps"}
            )
        )
        surv.add_child(
            create_survey_element_from_dict({"type": "imei", "name": "device_id"})
        )

        instance = surv.instantiate()
        import_xml = self.config.get(
            self.cls_name, "test_answers_can_be_imported_from_xml"
        )
        instance.import_from_xml(import_xml)

    def test_simple_registration_xml(self):
        reg_xform = Survey(name="Registration")
        name_question = create_survey_element_from_dict(
            {"type": "text", "name": "name", "label": "Name"}
        )
        reg_xform.add_child(name_question)

        reg_instance = reg_xform.instantiate()

        reg_instance.answer(name="name", value="bob")

        rx = reg_instance.to_xml()
        expected_xml = self.config.get(
            self.cls_name, "test_simple_registration_xml"
        ).format(reg_xform.id_string)
        self.assertEqual(rx, expected_xml)
