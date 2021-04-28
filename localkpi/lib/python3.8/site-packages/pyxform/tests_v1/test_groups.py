# -*- coding: utf-8 -*-
"""
Test XForm groups.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class GroupsTests(PyxformTestCase):
    """
    Test XForm groups.
    """

    def test_group_type(self):
        self.assertPyxformXform(
            md="""
            | survey |             |         |                  |
            |        | type        | name    | label            |
            |        | text        | pregrp  | Pregroup text    |
            |        | begin group | xgrp    | XGroup questions |
            |        | text        | xgrp_q1 | XGroup Q1        |
            |        | integer     | xgrp_q2 | XGroup Q2        |
            |        | end group   |         |                  |
            |        | note        | postgrp | Post group note  |
            """,
            model__contains=[
                "<pregrp/>",
                "<xgrp>",
                "<xgrp_q1/>",  # nopep8
                "<xgrp_q1/>",  # nopep8
                "<xgrp_q2/>",  # nopep8
                "</xgrp>",
                "<postgrp/>",
            ],
        )

    def test_group_intent(self):
        self.assertPyxformXform(
            name="intent_test",
            md="""
            | survey |             |         |                  |                                                             |
            |        | type        | name    | label            | intent                                                      |
            |        | text        | pregrp  | Pregroup text    |                                                             |
            |        | begin group | xgrp    | XGroup questions | ex:org.redcross.openmapkit.action.QUERY(osm_file=${pregrp}) |
            |        | text        | xgrp_q1 | XGroup Q1        |                                                             |
            |        | integer     | xgrp_q2 | XGroup Q2        |                                                             |
            |        | end group   |         |                  |                                                             |
            |        | note        | postgrp | Post group note  |                                                             |
            """,  # nopep8
            xml__contains=[
                '<group intent="ex:org.redcross.openmapkit.action.QUERY(osm_file= /intent_test/pregrp )" ref="/intent_test/xgrp">'  # nopep8
            ],
        )
