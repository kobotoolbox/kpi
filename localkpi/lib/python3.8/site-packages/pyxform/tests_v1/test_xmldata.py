# -*- coding: utf-8 -*-
"""
Test xml-external syntax.
"""
from pyxform.errors import PyXFormError
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase, PyxformTestError


class ExternalInstanceTests(PyxformTestCase):
    """
    External Instance Tests
    """

    def test_can__output_single_external_xml_item(self):
        """Simplest possible example to include an external instance."""
        self.assertPyxformXform(
            md="""
            | survey |              |        |       |
            |        | type         | name   | label |
            |        | xml-external | mydata |       |
            """,
            model__contains=['<instance id="mydata" src="jr://file/mydata.xml">'],
            run_odk_validate=True,
        )

    def test_cannot__use_same_external_xml_id_in_same_section(self):
        """Duplicate external instances in the same section raises an error."""
        with self.assertRaises(PyxformTestError) as ctx:
            self.assertPyxformXform(
                md="""
                | survey |              |        |       |
                |        | type         | name   | label |
                |        | xml-external | mydata |       |
                |        | xml-external | mydata |       |
                """,
                model__contains=[],
            )
        # This is caught first by existing validation rule.
        self.assertIn(
            "There are more than one survey elements named 'mydata'",
            repr(ctx.exception),
        )

    def test_can__use_unique_external_xml_in_same_section(self):
        """Two unique external instances in the same section is OK."""
        self.assertPyxformXform(
            md="""
            | survey |              |         |       |
            |        | type         | name    | label |
            |        | xml-external | mydata  |       |
            |        | xml-external | mydata2 |       |
            """,
            model__contains=[
                '<instance id="mydata" src="jr://file/mydata.xml">',
                '<instance id="mydata2" src="jr://file/mydata2.xml">',
            ],
            run_odk_validate=True,
        )

    def test_cannot__use_same_external_xml_id_across_groups(self):
        """Duplicate external instances anywhere raises an error."""
        with self.assertRaises(PyxformTestError) as ctx:
            self.assertPyxformXform(
                md="""
                | survey |              |        |       |
                |        | type         | name   | label |
                |        | xml-external | mydata |       |
                |        | begin group  | g1     |       |
                |        | xml-external | mydata |       |
                |        | end group    | g1     |       |
                |        | begin group  | g2     |       |
                |        | xml-external | mydata |       |
                |        | end group    | g2     |       |
                """,
                model__contains=[],
            )
        self.assertIn("Instance names must be unique", repr(ctx.exception))
        self.assertIn("The name 'mydata' was found 3 time(s)", repr(ctx.exception))

    def test_can__use_unique_external_xml_across_groups(self):
        """Unique external instances anywhere is OK."""
        self.assertPyxformXform(
            md="""
            | survey |              |         |                |
            |        | type         | name    | label          |
            |        | xml-external | mydata  |                |
            |        | begin group  | g1      |                |
            |        | xml-external | mydata1 |                |
            |        | note         | note1   | It's note-able |
            |        | end group    | g1      |                |
            |        | begin group  | g2      |                |
            |        | note         | note2   | It's note-able |
            |        | xml-external | mydata2 |                |
            |        | end group    | g2      |                |
            |        | begin group  | g3      |                |
            |        | note         | note3   | It's note-able |
            |        | xml-external | mydata3 |                |
            |        | end group    | g3      |                |
            """,
            model__contains=[
                '<instance id="mydata" src="jr://file/mydata.xml">',
                '<instance id="mydata1" src="jr://file/mydata1.xml">',
                '<instance id="mydata2" src="jr://file/mydata2.xml">',
                '<instance id="mydata3" src="jr://file/mydata3.xml">',
            ],
            run_odk_validate=True,
        )

    def test_cannot__use_same_external_xml_id_with_mixed_types(self):
        """Duplicate instances with other sources present raises an error."""
        with self.assertRaises(PyxformTestError) as ctx:
            self.assertPyxformXform(
                md="""
                | survey |                                      |      |       |                                             |
                |        | type                                 | name | label | calculation                                 |
                |        | begin group                          | g1   |       |                                             |
                |        | xml-external                         | city |       |                                             |
                |        | end group                            | g1   |       |                                             |
                |        | xml-external                         | city |       |                                             |
                |        | begin group                          | g2   |       |                                             |
                |        | select_one_from_file cities.csv      | city | City  |                                             |
                |        | end group                            | g2   |       |                                             |
                |        | begin group                          | g3   |       |                                             |
                |        | select_multiple_from_file cities.csv | city | City  |                                             |
                |        | end group                            | g3   |       |                                             |
                |        | begin group                          | g4   |       |                                             |
                |        | calculate                            | city | City  | pulldata('fruits', 'name', 'name', 'mango') |
                |        | end group                            | g4   |       |                                             |
                """,  # noqa
                model__contains=[],
            )
        self.assertIn("The name 'city' was found 2 time(s)", repr(ctx.exception))

    def test_can__use_all_types_together_with_unique_ids(self):
        """Unique instances with other sources present are OK."""
        self.assertPyxformXform(
            md="""
            | survey  |                                      |       |       |                                             |               |
            |         | type                                 | name  | label | calculation                                 | choice_filter |
            |         | begin group                          | g1    |       |                                             |               |
            |         | xml-external                         | city1 |       |                                             |               |
            |         | note                                 | note1 | Note  |                                             |               |
            |         | end group                            | g1    |       |                                             |               |
            |         | begin group                          | g2    |       |                                             |               |
            |         | select_one_from_file cities.csv      | city2 | City2 |                                             |               |
            |         | end group                            | g2    |       |                                             |               |
            |         | begin group                          | g3    |       |                                             |               |
            |         | select_multiple_from_file cities.csv | city3 | City3 |                                             |               |
            |         | end group                            | g3    |       |                                             |               |
            |         | begin group                          | g4    |       |                                             |               |
            |         | calculate                            | city4 | City4 | pulldata('fruits', 'name', 'name', 'mango') |               |
            |         | note                                 | note4 | Note  |                                             |               |
            |         | end group                            | g4    |       |                                             |               |
            |         | select_one states                    | test  | Test  |                                             | true()        |
            | choices |                                      |       |       |                                             |               |
            |         | list_name                            | name  | label |                                             |               |
            |         | states                               | 1     | Pass  |                                             |               |
            |         | states                               | 2     | Fail  |                                             |               |
            """,  # noqa
            model__contains=[
                '<instance id="city1" src="jr://file/city1.xml">',
                """
      <instance id="cities" src="jr://file-csv/cities.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>
""",
                '<instance id="fruits" src="jr://file-csv/fruits.csv">',
                """
      <instance id="states">
        <root>
          <item>
            <itextId>static_instance-states-0</itextId>
            <name>1</name>
          </item>
          <item>
            <itextId>static_instance-states-1</itextId>
            <name>2</name>
          </item>
        </root>
      </instance>
""",
            ],  # noqa
            run_odk_validate=True,
        )

    def test_cannot__use_different_src_same_id__select_then_internal(self):
        """Duplicate instance from internal choices raises an error: #88."""
        md = """
            | survey  |                                 |       |       |                                    |
            |         | type                            | name  | label | choice_filter                      |
            |         | select_one_from_file states.csv | state | State |                                    |
            |         | select_one states               | test  | Test  | state=/select_from_file_test/state |
            | choices |                                 |       |       |                                    |
            |         | list_name                       | name  | label |                                    |
            |         | states                          | 1     | Pass  |                                    |
            |         | states                          | 2     | Fail  |                                    |
            """  # noqa
        with self.assertRaises(PyXFormError) as ctx:
            survey = self.md_to_pyxform_survey(md_raw=md)
            survey._to_pretty_xml()
        self.assertIn(
            "Instance name: 'states', "
            "Existing type: 'file', Existing URI: 'jr://file-csv/states.csv', "
            "Duplicate type: 'choice', Duplicate URI: 'None', "
            "Duplicate context: 'survey'.",
            repr(ctx.exception),
        )

    def test_cannot__use_different_src_same_id__external_then_pulldata(self):
        """
        Duplicate instance from pulldata after xml-external raises an error.
        """
        md = """
            | survey |              |        |                  |                                             |
            |        | type         | name   | label            | calculation                                 |
            |        | begin group  | g1     |                  |                                             |
            |        | xml-external | fruits |                  |                                             |
            |        | calculate    | f_csv  | City             | pulldata('fruits', 'name', 'name', 'mango') |
            |        | note         | note   | Fruity! ${f_csv} |                                             |
            |        | end group    | g1     |                  |                                             |
            """  # noqa
        with self.assertRaises(PyXFormError) as ctx:
            survey = self.md_to_pyxform_survey(md_raw=md)
            survey._to_pretty_xml()
        self.assertIn(
            "Instance name: 'fruits', "
            "Existing type: 'external', Existing URI: 'jr://file/fruits.xml', "
            "Duplicate type: 'pulldata', Duplicate URI: 'jr://file-csv/fruits.csv', "  # noqa
            "Duplicate context: '[type: group, name: g1]'.",
            repr(ctx.exception),
        )

    def test_cannot__use_different_src_same_id__pulldata_then_external(self):
        """
        Duplicate instance from xml-external after pulldata raises an error.
        """
        md = """
            | survey |              |        |                  |                                             |
            |        | type         | name   | label            | calculation                                 |
            |        | begin group  | g1     |                  |                                             |
            |        | calculate    | f_csv  | City             | pulldata('fruits', 'name', 'name', 'mango') |
            |        | xml-external | fruits |                  |                                             |
            |        | note         | note   | Fruity! ${f_csv} |                                             |
            |        | end group    | g1     |                  |                                             |
            """  # noqa
        with self.assertRaises(PyXFormError) as ctx:
            survey = self.md_to_pyxform_survey(md_raw=md)
            survey._to_pretty_xml()
        self.assertIn(
            "Instance name: 'fruits', "
            "Existing type: 'pulldata', Existing URI: 'jr://file-csv/fruits.csv', "  # noqa
            "Duplicate type: 'external', Duplicate URI: 'jr://file/fruits.xml', "  # noqa
            "Duplicate context: '[type: group, name: g1]'.",
            repr(ctx.exception),
        )

    def test_can__reuse_csv__selects_then_pulldata(self):
        """Re-using the same csv external data source id and URI is OK."""
        md = """
            | survey |                                              |        |                                    |                                                   |
            |        | type                                         | name   | label                              | calculation                                       |
            |        | select_multiple_from_file pain_locations.csv | plocs  | Locations of pain this week.       |                                                   |
            |        | select_one_from_file pain_locations.csv      | pweek  | Location of worst pain this week.  |                                                   |
            |        | select_one_from_file pain_locations.csv      | pmonth | Location of worst pain this month. |                                                   |
            |        | select_one_from_file pain_locations.csv      | pyear  | Location of worst pain this year.  |                                                   |
            |        | calculate                                    | f_csv  | pd                                 | pulldata('pain_locations', 'name', 'name', 'arm') |
            |        | note                                         | note   | Arm ${f_csv}                       |                                                   |
            """  # noqa
        expected = """
      <instance id="pain_locations" src="jr://file-csv/pain_locations.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>
"""  # noqa
        self.assertPyxformXform(
            md=md, model__contains=[expected], run_odk_validate=True
        )
        survey = self.md_to_pyxform_survey(md_raw=md)
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(expected))

    def test_can__reuse_csv__pulldata_then_selects(self):
        """Re-using the same csv external data source id and URI is OK."""
        md = """
            | survey |                                              |        |                                    |                                                   |
            |        | type                                         | name   | label                              | calculation                                       |
            |        | calculate                                    | f_csv  | pd                                 | pulldata('pain_locations', 'name', 'name', 'arm') |
            |        | note                                         | note   | Arm ${f_csv}                       |                                                   |
            |        | select_multiple_from_file pain_locations.csv | plocs  | Locations of pain this week.       |                                                   |
            |        | select_one_from_file pain_locations.csv      | pweek  | Location of worst pain this week.  |                                                   |
            |        | select_one_from_file pain_locations.csv      | pmonth | Location of worst pain this month. |                                                   |
            |        | select_one_from_file pain_locations.csv      | pyear  | Location of worst pain this year.  |                                                   |
            """  # noqa
        expected = """
      <instance id="pain_locations" src="jr://file-csv/pain_locations.csv">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>
"""  # noqa
        self.assertPyxformXform(
            md=md, model__contains=[expected], run_odk_validate=True
        )

    def test_can__reuse_xml__selects_then_external(self):
        """Re-using the same xml external data source id and URI is OK."""
        md = """
            | survey |                                              |                |                                    |
            |        | type                                         | name           | label                              |
            |        | select_multiple_from_file pain_locations.xml | plocs          | Locations of pain this week.       |
            |        | select_one_from_file pain_locations.xml      | pweek          | Location of worst pain this week.  |
            |        | select_one_from_file pain_locations.xml      | pmonth         | Location of worst pain this month. |
            |        | select_one_from_file pain_locations.xml      | pyear          | Location of worst pain this year.  |
            |        | xml-external                                 | pain_locations |                                    |
            """  # noqa
        expected = """
      <instance id="pain_locations" src="jr://file/pain_locations.xml">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>
"""  # noqa
        survey = self.md_to_pyxform_survey(md_raw=md)
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(expected))

    def test_can__reuse_xml__external_then_selects(self):
        """Re-using the same xml external data source id and URI is OK."""
        md = """
            | survey |                                              |                |                                    |
            |        | type                                         | name           | label                              |
            |        | xml-external                                 | pain_locations |                                    |
            |        | select_multiple_from_file pain_locations.xml | plocs          | Locations of pain this week.       |
            |        | select_one_from_file pain_locations.xml      | pweek          | Location of worst pain this week.  |
            |        | select_one_from_file pain_locations.xml      | pmonth         | Location of worst pain this month. |
            |        | select_one_from_file pain_locations.xml      | pyear          | Location of worst pain this year.  |
            """  # noqa
        expected = """
      <instance id="pain_locations" src="jr://file/pain_locations.xml">
        <root>
          <item>
            <name>_</name>
            <label>_</label>
          </item>
        </root>
      </instance>
"""  # noqa
        self.assertPyxformXform(
            md=md, model__contains=[expected], run_odk_validate=True
        )
        survey = self.md_to_pyxform_survey(md_raw=md)
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(expected))

    def test_external_instance_pulldata_constraint(self):
        """
        Checks if instance node for pulldata function is added
        when pulldata occurs in column with constraint title
        """
        md = """
        | survey |        |         |                |                                                         |
        |        | type   | name    | label          | constraint                                              |
        |        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
        """
        node = """<instance id="ID" src="jr://file-csv/ID.csv">"""
        self.assertPyxformXform(md=md, xml__contains=[node])

    def test_external_instance_pulldata_readonly(self):
        """
        Checks if instance node for pulldata function is added
        when pulldata occurs in column with readonly title
        """
        md = """
        | survey |        |         |                |                                                         |
        |        | type   | name    | label          | readonly                                                |
        |        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
        """
        node = """<instance id="ID" src="jr://file-csv/ID.csv">"""

        self.assertPyxformXform(md=md, xml__contains=[node])

    def test_external_instance_pulldata_required(self):
        """
        Checks if instance node for pulldata function is added
        when pulldata occurs in column with required title
        """
        md = """
        | survey |        |         |                |                                                         |
        |        | type   | name    | label          | required                                                |
        |        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
        """
        node = """<instance id="ID" src="jr://file-csv/ID.csv">"""
        self.assertPyxformXform(md=md, xml__contains=[node], debug=False)

    def test_external_instance_pulldata_relevant(self):
        """
        Checks if instance node for pulldata function is added
        when pulldata occurs in column with relevant title
        """
        md = """
        | survey |        |         |                |                                                         |
        |        | type   | name    | label          | relevant                                                |
        |        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
        """
        node = """<instance id="ID" src="jr://file-csv/ID.csv">"""
        self.assertPyxformXform(md=md, xml__contains=[node], debug=False)

    def test_external_instance_pulldata(self):
        """
        Checks that only one instance node for pulldata is created
        if pulldata function is present in at least one columns with
        the titles: constraint, relevant, required, readonly
        """
        md = """
        | survey |        |         |                |                                                         |                                                         |                                                         |
        |        | type   | name    | label          | relevant                                                | required                                                | constraint                                              |
        |        | text   | Part_ID | Participant ID | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) | pulldata('ID', 'ParticipantID', 'ParticipantIDValue',.) |
        """
        node = """<instance id="ID" src="jr://file-csv/ID.csv">"""
        survey = self.md_to_pyxform_survey(md_raw=md)
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(node))

    def test_external_instances_multiple_diff_pulldatas(self):
        """
        Checks that all instances for pulldata that needs creation
        are created
        The situation is if pulldata is present in 2 or more
        columns but pulling data from different csv files
        """
        md = """
        | survey |        |         |                |                                                        |                                                             |
        |        | type   | name    | label          | relevant                                               | required                                                    |
        |        | text   | Part_ID | Participant ID | pulldata('fruits', 'name', 'name_key', 'mango')        | pulldata('OtherID', 'ParticipantID', ParticipantIDValue',.) |
        """
        node1 = '<instance id="fruits" src="jr://file-csv/fruits.csv">'
        node2 = '<instance id="OtherID" src="jr://file-csv/OtherID.csv">'

        survey = self.md_to_pyxform_survey(md_raw=md)
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(node1))
        self.assertEqual(1, xml.count(node2))
