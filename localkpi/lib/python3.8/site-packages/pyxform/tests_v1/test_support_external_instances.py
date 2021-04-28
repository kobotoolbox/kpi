# -*- coding: utf-8 -*-
"""
Test external instance syntax
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class ExternalCSVInstancesTest(PyxformTestCase):
    def test_external_csv_instances(self):
        # re: https://github.com/XLSForm/pyxform/issues/30
        self.assertPyxformXform(
            name="ecsv",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          |
            |        | select_one_from_file cities.csv              | city           | City           |
            |        | select_multiple_from_file neighbourhoods.csv | neighbourhoods | Neighbourhoods |
            """,  # noqa
            xml__contains=[
                """<instance id="cities" src="jr://file-csv/cities.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select1 ref="/ecsv/city">',
                "<itemset nodeset=\"instance('cities')/root/item\">",
                """<instance id="neighbourhoods" src="jr://file-csv/neighbourhoods.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select ref="/ecsv/neighbourhoods">',
                "<itemset nodeset=\"instance('neighbourhoods')/root/item\">",
            ],
            run_odk_validate=True,
        )

    def test_external_csv_instances_w_choice_filter(self):
        # re: https://github.com/XLSForm/pyxform/issues/30
        self.assertPyxformXform(
            name="ecsv",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          | choice_filter |
            |        | select_one_from_file cities.csv              | city           | City           |               |
            |        | select_multiple_from_file neighbourhoods.csv | neighbourhoods | Neighbourhoods | city=${city}  |
            """,  # noqa
            xml__contains=[
                """<instance id="cities" src="jr://file-csv/cities.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select1 ref="/ecsv/city">',
                """<instance id="neighbourhoods" src="jr://file-csv/neighbourhoods.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select ref="/ecsv/neighbourhoods">',
                "<itemset nodeset=\"instance('neighbourhoods')/root/item[city= /ecsv/city ]\">",  # noqa
            ],
            run_odk_validate=True,
        )


class ExternalXMLInstancesTest(PyxformTestCase):
    def test_external_xml_instances(self):
        # re: https://github.com/XLSForm/pyxform/issues/30
        self.assertPyxformXform(
            name="exml",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          |
            |        | select_one_from_file cities.xml              | city           | City           |
            |        | select_multiple_from_file neighbourhoods.xml | neighbourhoods | Neighbourhoods |
            """,  # noqa
            xml__contains=[
                """<instance id="cities" src="jr://file/cities.xml">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select1 ref="/exml/city">',
                "<itemset nodeset=\"instance('cities')/root/item\">",
                """<instance id="neighbourhoods" src="jr://file/neighbourhoods.xml">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>""",  # noqa
                '<select ref="/exml/neighbourhoods">',
                "<itemset nodeset=\"instance('neighbourhoods')/root/item\">",
            ],
            run_odk_validate=True,
        )


class InvalidExternalFileInstancesTest(PyxformTestCase):
    def test_external_other_extension_instances(self):
        # re: https://github.com/XLSForm/pyxform/issues/30
        self.assertPyxformXform(
            name="epdf",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          |
            |        | select_one_from_file cities.pdf              | city           | City           |
            |        | select_multiple_from_file neighbourhoods.pdf | neighbourhoods | Neighbourhoods |
            """,  # noqa
            errored=True,
            error_contains=["should be a choices sheet in this xlsform"],
        )

    def test_external_choices_sheet_included_instances(self):
        # re: https://github.com/XLSForm/pyxform/issues/30
        self.assertPyxformXform(
            name="epdf",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          |
            |        | select_one_from_file cities.pdf              | city           | City           |
            |        | select_multiple_from_file neighbourhoods.pdf | neighbourhoods | Neighbourhoods |

            | choices |
            |         | list name | name  | label |
            |         | fruits    | apple | Apple |
            """,  # noqa
            errored=True,
            error__contains=["List name not in choices sheet: cities.pdf"],
        )


class ExternalCSVInstancesBugsTest(PyxformTestCase):
    def test_non_existent_itext_reference(self):
        # re: https://github.com/XLSForm/pyxform/issues/80
        self.assertPyxformXform(
            name="ecsv",
            md="""
            | survey |                                              |                |                |
            |        | type                                         | name           | label          |
            |        | select_one_from_file cities.csv              | city           | City           |
            |        | select_multiple_from_file neighbourhoods.csv | neighbourhoods | Neighbourhoods |
            """,  # noqa
            xml__contains=[
                """<itemset nodeset="instance('cities')/root/item">
        <value ref="name"/>
        <label ref="label"/>
      </itemset>"""
            ],
        )

    def test_external_choices_sheet_values_required(self):
        md = """
            | survey           |                               |          |           |                                     |
            |                  | type                          | name     | label     | choice_filter                       |
            |                  | text                          | S1       | s1        |                                     |
            |                  | select_one_external counties  | county   | county    | S1=${S1}                            |
            |                  | select_one_external cities    | city     | city      | S1=${S1} and county=${county}       |
            | choices          |                               |          |           |
            |                  | list name                     | name     | label     |
            |                  | list                          | option a | a         |
            | external_choices |              |                |
            |                  | list_name    | name           |
            |                  | counties     | Kajiado        |
            |                  | counties     | Nakuru         |
            |                  | cities       | Kisumu         |
            |                  | cities       | Mombasa        |
            """
        expected = """
    <input query="instance('cities')/root/item[S1= /pyxform_autotestname/S1  and county= /pyxform_autotestname/county ]" ref="/pyxform_autotestname/city">
"""

        self.assertPyxformXform(
            md=md, debug=False, xml__contains=[expected], run_odk_validate=True
        )

    def test_list_name_not_in_external_choices_sheet_raises_error(self):
        self.assertPyxformXform(
            md="""
                | survey           |                              |                |           |                                     |
                |                  | type                         | name           | label     | choice_filter                       |
                |                  | select_one list              | S1             | s1        |                                     |
                |                  | select_one_external counties | county         | County    | S1=${S1}                            |
                |                  | select_one_external cities   | city           | City      | S1=${S1} and county=${county}       |
                | choices          |                              |                |           |
                |                  | list name                    | name           | label     |
                |                  | list                         | option a       | a         |
                |                  | list                         | option b       | b         |
                |                  | list                         | option c       | c         |
                | external_choices |                              |                |
                |                  | list_name                    | name           |
                |                  | counties                     | Kajiado        |
                |                  | counties                     | Nakuru         |
                """,  # noqa
            errored=True,
            error__contains=["List name not in external choices sheet: cities"],
        )
