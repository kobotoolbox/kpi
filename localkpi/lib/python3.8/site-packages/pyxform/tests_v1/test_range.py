# -*- coding: utf-8 -*-
"""
Test range widget.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class RangeWidgetTest(PyxformTestCase):
    def test_range_type(self):
        # parameters column
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | start=1 end=10 step=1 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

        # mixed case parameters
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | Start=3 End=14 STEP=2 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="14" ref="/data/level" start="3" step="2">',
            ],
        )

    def test_range_type_defaults(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale |                     |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | end=20              |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="20" ref="/data/level" start="1" step="1">',
            ],
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | range  |   level  | Scale |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

    def test_range_type_float(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | start=0.5 end=5.0 step=0.5 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="decimal"/>',
                '<range end="5.0" ref="/data/level" start="0.5" step="0.5">',
            ],
        )

    def test_range_type_invvalid_parameters(self):
        # 'increment' is an invalid property
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                        |
            |        | type   |   name   | label | parameters             |
            |        | range  |   level  | Scale | increment=0.5 end=21.5 |
            """,
            errored=True,
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | start=0.5 end=X step=0.5 |
            """,
            errored=True,
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                     |
            |        | type   |   name   | label | parameters          |
            |        | range  |   level  | Scale | start               |
            """,
            errored=True,
        )

    def test_range_semicolon_separator(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                       |
            |        | type   |   name   | label | parameters            |
            |        | range  |   level  | Scale | start=1;end=10;step=1 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

    def test_range_comma_separator(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                       |
            |        | type   |   name   | label | parameters            |
            |        | range  |   level  | Scale | start=1,end=10,step=1 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                           |
            |        | type   |   name   | label | parameters                |
            |        | range  |   level  | Scale | start=1 , end=10 , step=1 |
            """,
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="1">',
            ],
        )

        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                                 |
            |        | type   |   name   | label | parameters                      |
            |        | range  |   level  | Scale | start = 1 , end = 10 , step = 2 |
            """,  # noqa
            xml__contains=[
                '<bind nodeset="/data/level" type="int"/>',
                '<range end="10" ref="/data/level" start="1" step="2">',
            ],
        )
