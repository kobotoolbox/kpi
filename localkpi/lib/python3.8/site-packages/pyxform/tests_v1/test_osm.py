# -*- coding: utf-8 -*-
"""
Test OSM widgets.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase

expected_xml_output = """
    <upload mediatype="osm/*" ref="/osm/osm_building">
      <label>Building</label>
      <tag key="name">
        <label>Name</label>
      </tag>
      <tag key="addr:city">
        <label>City</label>
      </tag>
    </upload>"""


class OSMWidgetsTest(PyxformTestCase):
    """
    Test OSM widgets.
    """

    def test_osm_type(self):
        self.assertPyxformXform(
            name="osm",
            run_odk_validate=True,
            md="""
            | survey |                   |              |          |
            |        | type              |   name       | label    |
            |        | osm               | osm_road     | Road     |
            |        | osm building_tags | osm_building | Building |
            | osm    |                   |              |          |
            |        | list name         |  name        | label    |
            |        | building_tags     | name         | Name     |
            |        | building_tags     | addr:city    | City     |

            """,
            xml__contains=[expected_xml_output],
        )

    def test_osm_type_with_list_underscore_name(self):
        self.assertPyxformXform(
            name="osm",
            md="""
            | survey |                   |              |          |
            |        | type              |   name       | label    |
            |        | osm               | osm_road     | Road     |
            |        | osm building_tags | osm_building | Building |
            | osm    |                   |              |          |
            |        | list_name         |  name        | label    |
            |        | building_tags     | name         | Name     |
            |        | building_tags     | addr:city    | City     |

            """,
            xml__contains=[expected_xml_output],
        )
