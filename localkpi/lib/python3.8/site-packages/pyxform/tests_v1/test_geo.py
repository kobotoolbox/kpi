# -*- coding: utf-8 -*-
"""
Test geo widgets.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class GeoWidgetsTest(PyxformTestCase):
    """Test geo widgets class."""

    def test_gps_type(self):
        self.assertPyxformXform(
            name="geo",
            md="""
            | survey |      |          |       |
            |        | type |   name   | label |
            |        | gps  | location | GPS   |
            """,
            xml__contains=["geopoint"],
        )

    def test_gps_alias(self):
        self.assertPyxformXform(
            name="geo_alias",
            md="""
            | survey |          |          |       |
            |        | type     | name     | label |
            |        | geopoint | location | GPS   |
            """,
            xml__contains=["geopoint"],
        )

    def test_geo_widgets_types(self):
        """
        this test could be broken into multiple smaller tests.
        """
        self.assertPyxformXform(
            name="geos",
            md="""
            | survey |              |            |                   |
            |        | type         | name       | label             |
            |        | begin_repeat | repeat     |                   |
            |        | geopoint     | point      | Record Geopoint   |
            |        | note         | point_note | Point ${point}    |
            |        | geotrace     | trace      | Record a Geotrace |
            |        | note         | trace_note | Trace: ${trace}   |
            |        | geoshape     | shape      | Record a Geoshape |
            |        | note         | shape_note | Shape: ${shape}   |
            |        | end_repeat   |            |                   |
            """,
            xml__contains=[
                "<point/>",
                "<point_note/>",
                "<trace/>",
                "<trace_note/>",
                "<shape/>",
                "<shape_note/>",
                '<bind nodeset="/geos/repeat/point" type="geopoint"/>',
                '<bind nodeset="/geos/repeat/point_note" readonly="true()" '
                'type="string"/>',
                '<bind nodeset="/geos/repeat/trace" type="geotrace"/>',
                '<bind nodeset="/geos/repeat/trace_note" readonly="true()" '
                'type="string"/>',
                '<bind nodeset="/geos/repeat/shape" type="geoshape"/>',
                '<bind nodeset="/geos/repeat/shape_note" readonly="true()" '
                'type="string"/>',
            ],
        )
