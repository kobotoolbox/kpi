# -*- coding: utf-8 -*-
"""
Test rank widget.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class RangeWidgetTest(PyxformTestCase):
    def test_rank(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |              |          |       |
            |        | type         | name     | label |
            |        | rank mylist  | order    | Rank  |
            | choices|              |          |       |
            |        | list_name    | name     | label |
            |        | mylist       | a        | A     |
            |        | mylist       | b        | B     |
            """,
            xml__contains=[
                'xmlns:odk="http://www.opendatakit.org/xforms"',
                '<bind nodeset="/data/order" type="odk:rank"/>',
                '<odk:rank ref="/data/order">',
                "<label>Rank</label>",
                "<label>A</label>",
                "<value>a</value>",
                "<label>B</label>",
                "<value>b</value>",
                "</odk:rank>",
            ],
        )

    def test_rank_filter(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |              |          |       |               |
            |        | type         | name     | label | choice_filter |
            |        | rank mylist  | order    | Rank  | color='blue'  |
            | choices|              |          |       |
            |        | list_name    | name     | label | color |
            |        | mylist       | a        | A     | red   |
            |        | mylist       | b        | B     | blue  |
           """,
            xml__contains=[
                'xmlns:odk="http://www.opendatakit.org/xforms"',
                '<bind nodeset="/data/order" type="odk:rank"/>',
                '<instance id="mylist">',
                "<color>red</color>",
                "<name>a</name>",
                "<color>blue</color>",
                "<name>b</name>",
                """<odk:rank ref="/data/order">
      <label>Rank</label>
      <itemset nodeset="instance('mylist')/root/item[color='blue']">
        <value ref="name"/>
        <label ref="jr:itext(itextId)"/>
      </itemset>
    </odk:rank>""",
            ],
        )

    def test_rank_translations(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |              |          |       |                    |
            |        | type         | name     | label | label::French (fr) |
            |        | rank mylist  | order    | Rank  | Ranger             |
            | choices|              |          |       |
            |        | list_name    | name     | label | label::French (fr) |
            |        | mylist       | a        | A     |  AA                |
            |        | mylist       | b        | B     |  BB                |
            """,
            xml__contains=[
                'xmlns:odk="http://www.opendatakit.org/xforms"',
                '<translation lang="French (fr)">',
                """<text id="/data/order:label">
            <value>Ranger</value>
          </text>""",
                """<text id="/data/order/a:label">
            <value>AA</value>
          </text>""",
                """<text id="/data/order/b:label">
            <value>BB</value>
          </text>""",
                "</translation>",
                """<odk:rank ref="/data/order">
      <label ref="jr:itext('/data/order:label')"/>
      <item>
        <label ref="jr:itext('/data/order/a:label')"/>
        <value>a</value>
      </item>
      <item>
        <label ref="jr:itext('/data/order/b:label')"/>
        <value>b</value>
      </item>
    </odk:rank>""",
            ],
        )
