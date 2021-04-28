# -*- coding: utf-8 -*-
"""
Test setgeopoint widget.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class SetGeopointTest(PyxformTestCase):
    """Test setgeopoint widget class."""

    def test_setgeopoint(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                |             |          |
            |        | type           | name        | label    |
            |        | start-geopoint | my-location | my label |
            """,
            xml__contains=[
                '<bind nodeset="/data/my-location" type="geopoint"/>',
                '<odk:setgeopoint event="odk-instance-first-load" ref="/data/my-location"/>',
                "",
            ],
            run_odk_validate=True,
        )
