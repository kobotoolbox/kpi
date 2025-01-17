# coding: utf-8
import csv
import os
from tempfile import NamedTemporaryFile

from django.utils.dateparse import parse_datetime

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.logger.xform_instance_parser import xform_instance_to_dict
from kobo.apps.openrosa.apps.viewer.pandas_mongo_bridge import AbstractDataFrameBuilder,\
    CSVDataFrameBuilder, CSVDataFrameWriter, ExcelWriter,\
    get_prefix_from_xpath, get_valid_sheet_name, XLSDataFrameBuilder,\
    XLSDataFrameWriter, remove_dups_from_list_maintain_order
from kobo.apps.openrosa.libs.utils.common_tags import NA_REP


def xls_filepath_from_fixture_name(fixture_name):
    """
    Return an xls file path at tests/fixtures/[fixture]/fixture.xls
    """
    # TODO currently this only works for fixtures in this app because of
    # __file__
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "fixtures", fixture_name, fixture_name + ".xls"
    )


def xml_inst_filepath_from_fixture_name(fixture_name, instance_name):
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "fixtures", fixture_name, "instances",
        fixture_name + "_" + instance_name + ".xml"
    )


class TestPandasMongoBridge(TestBase):
    def setUp(self):
        self._create_user_and_login()
        self._submission_time = parse_datetime('2013-02-18 15:54:01Z')

    def _publish_xls_fixture_set_xform(self, fixture):
        """
        Publish an xls file at tests/fixtures/[fixture]/fixture.xls
        """
        xls_file_path = xls_filepath_from_fixture_name(fixture)
        count = XForm.objects.count()
        self._publish_xls_file(xls_file_path)
        self.assertEqual(XForm.objects.count(), count + 1)
        self.xform = XForm.objects.all().reverse()[0]

    def _submit_fixture_instance(
            self, fixture, instance, submission_time=None, add_submission_uuid=None):
        """
        Submit an instance at
        tests/fixtures/[fixture]/instances/[fixture]_[instance].xml
        """
        xml_submission_file_path = xml_inst_filepath_from_fixture_name(
            fixture, instance)

        if add_submission_uuid:
            xml_submission_file_path = (
                self._add_submission_uuid_to_submission_xml(
                    xml_submission_file_path
                )
            )
        try:
            self._make_submission(
                xml_submission_file_path, forced_submission_time=submission_time)
            self.assertEqual(self.response.status_code, 201)
        finally:
            if add_submission_uuid:
                os.remove(xml_submission_file_path)

    def _publish_single_level_repeat_form(self):
        self._publish_xls_fixture_set_xform("new_repeats")
        self.survey_name = "new_repeats"

    def _publish_nested_repeats_form(self):
        self._publish_xls_fixture_set_xform("nested_repeats")
        self.survey_name = "nested_repeats"

    def _publish_grouped_gps_form(self):
        self._publish_xls_fixture_set_xform("grouped_gps")
        self.survey_name = "grouped_gps"

    def _xls_data_for_dataframe(self):
        xls_df_builder = XLSDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        cursor = xls_df_builder._query_mongo()
        return xls_df_builder._format_for_dataframe(cursor)

    def _csv_data_for_dataframe(self):
        csv_df_builder = CSVDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        cursor = csv_df_builder._query_mongo()
        return csv_df_builder._format_for_dataframe(cursor)

    def test_generated_sections(self):
        self._publish_single_level_repeat_form()
        self._submit_fixture_instance("new_repeats", "01")
        xls_df_builder = XLSDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        expected_section_keys = [self.survey_name, "kids_details"]
        section_keys = xls_df_builder.sections.keys()
        self.assertEqual(sorted(expected_section_keys), sorted(section_keys))

    def test_row_counts(self):
        """
        Test the number of rows in each sheet

        We expect a single row in the main new_repeats sheet and 2 rows in the
        kids details sheet one for each repeat
        """
        self._publish_single_level_repeat_form()
        self._submit_fixture_instance("new_repeats", "01")
        data = self._xls_data_for_dataframe()
        self.assertEqual(len(data[self.survey_name]), 1)
        self.assertEqual(len(data["kids_details"]), 2)

    def test_xls_columns(self):
        """
        Test that our expected columns are in the data
        """
        self._publish_single_level_repeat_form()
        self._submit_fixture_instance("new_repeats", "01")
        data = self._xls_data_for_dataframe()
        # columns in the default sheet
        expected_default_columns = [
            "gps",
            "_gps_latitude",
            "_gps_longitude",
            "_gps_altitude",
            "_gps_precision",
            "web_browsers/firefox",
            "web_browsers/safari",
            "web_browsers/ie",
            "info/age",
            "web_browsers/chrome",
            "kids/has_kids",
            "info/name",
            "meta/instanceID"
        ] + AbstractDataFrameBuilder.ADDITIONAL_COLUMNS +\
            XLSDataFrameBuilder.EXTRA_COLUMNS
        # get the header
        default_columns = [k for k in data[self.survey_name][0]]
        self.assertEqual(sorted(expected_default_columns),
                         sorted(default_columns))

        # columns in the kids_details sheet
        expected_kids_details_columns = [
            "kids/kids_details/kids_name",
            "kids/kids_details/kids_age"
        ] + AbstractDataFrameBuilder.ADDITIONAL_COLUMNS +\
            XLSDataFrameBuilder.EXTRA_COLUMNS
        kids_details_columns = [k for k in data["kids_details"][0]]
        self.assertEqual(sorted(expected_kids_details_columns),
                         sorted(kids_details_columns))

    def test_xls_columns_for_gps_within_groups(self):
        """
        Test that a valid xpath is generated for extra gps fields that are NOT
        top level
        """
        self._publish_grouped_gps_form()
        self._submit_fixture_instance("grouped_gps", "01")
        data = self._xls_data_for_dataframe()
        # columns in the default sheet
        expected_default_columns = [
            "gps_group/gps",
            "gps_group/_gps_latitude",
            "gps_group/_gps_longitude",
            "gps_group/_gps_altitude",
            "gps_group/_gps_precision",
            "web_browsers/firefox",
            "web_browsers/safari",
            "web_browsers/ie",
            "web_browsers/chrome",
            "meta/instanceID"
        ] + AbstractDataFrameBuilder.ADDITIONAL_COLUMNS +\
            XLSDataFrameBuilder.EXTRA_COLUMNS
        default_columns = [k for k in data[self.survey_name][0]]
        self.assertEqual(sorted(expected_default_columns),
                         sorted(default_columns))

    def test_csv_dataframe_export_to(self):
        self._publish_nested_repeats_form()
        self._submit_fixture_instance(
            "nested_repeats", "01", submission_time=self._submission_time)
        self._submit_fixture_instance(
            "nested_repeats", "02", submission_time=self._submission_time)
        csv_df_builder = CSVDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        temp_file = NamedTemporaryFile(suffix=".csv", delete=False)
        csv_df_builder.export_to(temp_file.name)
        csv_fixture_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "fixtures", "nested_repeats", "nested_repeats.csv"
        )
        temp_file.close()
        fixture, output = '', ''
        with open(csv_fixture_path) as f:
            fixture = f.read()
        with open(temp_file.name) as f:
            output = f.read()
        os.unlink(temp_file.name)
        self.assertEqual(fixture, output)

    def test_csv_columns_for_gps_within_groups(self):
        self._publish_grouped_gps_form()
        self._submit_fixture_instance("grouped_gps", "01")
        data = self._csv_data_for_dataframe()
        columns = data[0].keys()
        expected_columns = [
            'gps_group/gps',
            'gps_group/_gps_latitude',
            'gps_group/_gps_longitude',
            'gps_group/_gps_altitude',
            'gps_group/_gps_precision',
            'meta/instanceID',
            'web_browsers/firefox',
            'web_browsers/chrome',
            'web_browsers/ie',
            'web_browsers/safari',
        ] + AbstractDataFrameBuilder.ADDITIONAL_COLUMNS +\
            AbstractDataFrameBuilder.IGNORED_COLUMNS
        try:
            # `_deleted_at` is no longer used but may persist in old submissions
            expected_columns.remove('_deleted_at')
        except ValueError:
            pass
        self.maxDiff = None
        self.assertEqual(sorted(expected_columns), sorted(columns))

    def test_format_mongo_data_for_csv(self):
        self.maxDiff = None
        self._publish_single_level_repeat_form()
        self._submit_fixture_instance("new_repeats", "01")
        self.xform.data_dictionary()
        data_0 = self._csv_data_for_dataframe()[0]
        # remove AbstractDataFrameBuilder.INTERNAL_FIELDS
        for key in AbstractDataFrameBuilder.IGNORED_COLUMNS:
            if key in data_0:
                data_0.pop(key)
        for key in AbstractDataFrameBuilder.ADDITIONAL_COLUMNS:
            if key in data_0:
                data_0.pop(key)
        expected_data_0 = {
            'gps': '-1.2627557 36.7926442 0.0 30.0',
            '_gps_latitude': '-1.2627557',
            '_gps_longitude': '36.7926442',
            '_gps_altitude': '0.0',
            '_gps_precision': '30.0',
            'kids/has_kids': '1',
            'info/age': '80',
            'kids/kids_details[1]/kids_name': 'Abel',
            'kids/kids_details[1]/kids_age': '50',
            'kids/kids_details[2]/kids_name': 'Cain',
            'kids/kids_details[2]/kids_age': '76',
            'meta/instanceID': 'uuid:435f173c688e482463a486617004534df',
            'web_browsers/chrome': True,
            'web_browsers/ie': True,
            'web_browsers/safari': False,
            'web_browsers/firefox': False,
            'info/name': 'Adam',
        }
        self.assertEqual(expected_data_0, data_0)

    def test_split_select_multiples(self):
        self._publish_nested_repeats_form()
        dd = self.xform.data_dictionary()
        self._submit_fixture_instance("nested_repeats", "01")
        csv_df_builder = CSVDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        cursor = csv_df_builder._query_mongo()
        record = cursor[0]
        select_multiples = CSVDataFrameBuilder._collect_select_multiples(dd)
        result = CSVDataFrameBuilder._split_select_multiples(record,
                                                             select_multiples)
        expected_result = {
            'web_browsers/ie': True,
            'web_browsers/safari': True,
            'web_browsers/firefox': False,
            'web_browsers/chrome': False
        }
        # build a new dictionary only composed of the keys we want to use in
        # the comparison
        result = dict([(key, result[key]) for key in result.keys() if key in
                      expected_result.keys()])
        self.assertEqual(expected_result, result)
        csv_df_builder = CSVDataFrameBuilder(self.user.username,
                                             self.xform.id_string,
                                             binary_select_multiples=True)
        result = csv_df_builder._split_select_multiples(record,
                                                        select_multiples)
        expected_result = {
            'web_browsers/ie': 1,
            'web_browsers/safari': 1,
            'web_browsers/firefox': 0,
            'web_browsers/chrome': 0
        }
        # build a new dictionary only composed of the keys we want to use in
        # the comparison
        result = dict([(key, result[key]) for key in result.keys() if key in
                      expected_result.keys()])
        self.assertEqual(expected_result, result)

    def test_split_select_multiples_within_repeats(self):
        self.maxDiff = None
        record = {
            'name': 'Tom',
            'age': 23,
            'browser_use': [
                {
                    'browser_use/year': '2010',
                    'browser_use/browsers': 'firefox safari'
                },
                {
                    'browser_use/year': '2011',
                    'browser_use/browsers': 'firefox chrome'
                }
            ]
        }
        expected_result = {
            'name': 'Tom',
            'age': 23,
            'browser_use': [
                {
                    'browser_use/year': '2010',
                    'browser_use/browsers/firefox': True,
                    'browser_use/browsers/safari': True,
                    'browser_use/browsers/ie': False,
                    'browser_use/browsers/chrome': False
                },
                {
                    'browser_use/year': '2011',
                    'browser_use/browsers/firefox': True,
                    'browser_use/browsers/safari': False,
                    'browser_use/browsers/ie': False,
                    'browser_use/browsers/chrome': True
                }
            ]
        }
        select_multiples = {
            'browser_use/browsers': [
                'browser_use/browsers/firefox',
                'browser_use/browsers/safari',
                'browser_use/browsers/ie',
                'browser_use/browsers/chrome']}
        result = CSVDataFrameBuilder._split_select_multiples(record,
                                                             select_multiples)
        self.assertEqual(expected_result, result)

    def test_split_gps_fields(self):
        record = {
            'gps': '5 6 7 8'
        }
        gps_fields = ['gps']
        expected_result = {
            'gps': '5 6 7 8',
            '_gps_latitude': '5',
            '_gps_longitude': '6',
            '_gps_altitude': '7',
            '_gps_precision': '8',
        }
        AbstractDataFrameBuilder._split_gps_fields(record, gps_fields)
        self.assertEqual(expected_result, record)

    def test_split_gps_fields_within_repeats(self):
        record = {
            'a_repeat': [
                {
                    'a_repeat/gps': '1 2 3 4'
                },
                {
                    'a_repeat/gps': '5 6 7 8'
                }
            ]
        }
        gps_fields = ['a_repeat/gps']
        expected_result = {
            'a_repeat': [
                {
                    'a_repeat/gps': '1 2 3 4',
                    'a_repeat/_gps_latitude': '1',
                    'a_repeat/_gps_longitude': '2',
                    'a_repeat/_gps_altitude': '3',
                    'a_repeat/_gps_precision': '4',
                },
                {
                    'a_repeat/gps': '5 6 7 8',
                    'a_repeat/_gps_latitude': '5',
                    'a_repeat/_gps_longitude': '6',
                    'a_repeat/_gps_altitude': '7',
                    'a_repeat/_gps_precision': '8',
                }
            ]
        }
        AbstractDataFrameBuilder._split_gps_fields(record, gps_fields)
        self.assertEqual(expected_result, record)

    def test_unicode_export(self):
        unicode_char = chr(40960)
        # fake data
        data = [{'key': unicode_char}]
        columns = ['key']
        # test xls
        xls_df_writer = XLSDataFrameWriter(data, columns)
        temp_file = NamedTemporaryFile(suffix='.xlsx', mode='w')
        excel_writer = ExcelWriter(temp_file.name)
        passed = False
        try:
            xls_df_writer.write_to_excel(excel_writer, 'default')
            passed = True
        except UnicodeEncodeError:
            pass
        finally:
            temp_file.close()
        self.assertTrue(passed)
        # test csv
        passed = False
        csv_df_writer = CSVDataFrameWriter(data, columns)
        temp_file = NamedTemporaryFile(suffix='.csv', mode='w')
        try:
            csv_df_writer.write_to_csv(temp_file)
            passed = True
        except UnicodeEncodeError:
            pass
        finally:
            temp_file.close()
        temp_file.close()
        self.assertTrue(passed)

    def test_repeat_child_name_matches_repeat(self):
        """
        ParsedInstance.to_dict creates a list within a repeat if a child has
        the same name as the repeat. This test makes sure that doesnt happen
        """
        self.maxDiff = None
        fixture = "repeat_child_name_matches_repeat"
        # publish form so we have a dd to pass to xform inst. parser
        self._publish_xls_fixture_set_xform(fixture)
        submission_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "fixtures", fixture, fixture + ".xml"
        )
        # get submission xml str
        with open(submission_path, "r") as f:
            xml_str = f.read()
        dict = xform_instance_to_dict(xml_str, self.xform.data_dictionary())
        expected_dict = {
            'test_item_name_matches_repeat': {
                'formhub': {
                    'uuid': 'c911d71ce1ac48478e5f8bac99addc4e'
                },
                'gps': [
                    {
                        'info': 'Yo',
                        'gps': '-1.2625149 36.7924478 0.0 30.0'
                    },
                    {
                        'info': 'What',
                        'gps': '-1.2625072 36.7924328 0.0 30.0'
                    }
                ]
            }
        }
        self.assertEqual(dict, expected_dict)

    def test_remove_dups_from_list_maintain_order(self):
        l = ["a", "z", "b", "y", "c", "b", "x"]
        result = remove_dups_from_list_maintain_order(l)
        expected_result = ["a", "z", "b", "y", "c", "x"]
        self.assertEqual(result, expected_result)

    def test_valid_sheet_name(self):
        sheet_names = ["sheet_1", "sheet_2"]
        desired_sheet_name = "sheet_3"
        expected_sheet_name = "sheet_3"
        generated_sheet_name = get_valid_sheet_name(desired_sheet_name,
                                                    sheet_names)
        self.assertEqual(generated_sheet_name, expected_sheet_name)

    def test_invalid_sheet_name(self):
        sheet_names = ["sheet_1", "sheet_2"]
        desired_sheet_name = "sheet_3_with_more_than_max_expected_length"
        expected_sheet_name = "sheet_3_with_more_than_max_exp"
        generated_sheet_name = get_valid_sheet_name(desired_sheet_name,
                                                    sheet_names)
        self.assertEqual(generated_sheet_name, expected_sheet_name)

    def test_duplicate_sheet_name(self):
        sheet_names = ["sheet_2_with_duplicate_sheet_n",
                       "sheet_2_with_duplicate_sheet_1"]
        duplicate_sheet_name = "sheet_2_with_duplicate_sheet_n"
        expected_sheet_name = "sheet_2_with_duplicate_sheet_2"
        generated_sheet_name = get_valid_sheet_name(duplicate_sheet_name,
                                                    sheet_names)
        self.assertEqual(generated_sheet_name, expected_sheet_name)

    def test_query_mongo(self):
        """
        Test querying for record count and records using
        AbstractDataFrameBuilder._query_mongo
        """
        self._publish_single_level_repeat_form()
        # submit 3 instances
        for i in range(3):
            self._submit_fixture_instance('new_repeats', '03', None, True)
        df_builder = XLSDataFrameBuilder(self.user.username,
                                         self.xform.id_string)
        record_count = df_builder._query_mongo(count=True)
        self.assertEqual(record_count, 3)
        cursor = df_builder._query_mongo()
        records = [record for record in cursor]
        self.assertTrue(len(records), 3)
        # test querying using limits
        cursor = df_builder._query_mongo(start=2, limit=2)
        records = [record for record in cursor]
        self.assertTrue(len(records), 1)

    def test_prefix_from_xpath(self):
        xpath = "parent/child/grandhild"
        prefix = get_prefix_from_xpath(xpath)
        self.assertEqual(prefix, 'parent/child/')
        xpath = "parent/child"
        prefix = get_prefix_from_xpath(xpath)
        self.assertEqual(prefix, 'parent/')
        xpath = "parent"
        prefix = get_prefix_from_xpath(xpath)
        self.assertTrue(prefix is None)

    def test_csv_export_with_df_size_limit(self):
        """
        To fix pandas limitation of 30k rows on csv export, we specify a max
        number of records in a dataframe on export - lets test it
        """
        self._publish_single_level_repeat_form()
        # submit 7 instances
        for i in range(4):
            self._submit_fixture_instance('new_repeats', '03', None, True)
        self._submit_fixture_instance("new_repeats", "02")
        for i in range(2):
            self._submit_fixture_instance('new_repeats', '03', None, True)
        csv_df_builder = CSVDataFrameBuilder(self.user.username,
                                             self.xform.id_string)
        record_count = csv_df_builder._query_mongo(count=True)
        self.assertEqual(record_count, 7)
        temp_file = NamedTemporaryFile(suffix=".csv", delete=False)
        csv_df_builder.export_to(temp_file.name, data_frame_max_size=3)
        csv_file = open(temp_file.name)
        csv_reader = csv.reader(csv_file)
        header = next(csv_reader)
        self.assertEqual(
            len(header), 17 + len(AbstractDataFrameBuilder.ADDITIONAL_COLUMNS))
        rows = []
        for row in csv_reader:
            rows.append(row)
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[4][5], NA_REP)
        # close and delete file
        csv_file.close()
        os.unlink(temp_file.name)

    def test_csv_column_indices_in_groups_within_repeats(self):
        # See `_submitted_data` in `expected_data_0` below
        self._publish_xls_fixture_set_xform("groups_in_repeats")
        self._submit_fixture_instance("groups_in_repeats", "01")
        dd = self.xform.data_dictionary()
        dd.get_keys()
        data_0 = self._csv_data_for_dataframe()[0]
        # remove dynamic fields
        ignore_list = [
            '_uuid', 'meta/instanceID', 'formhub/uuid', '_submission_time',
            '_id']
        for item in ignore_list:
            data_0.pop(item)
        expected_data_0 = {
            '_xform_id_string': 'groups_in_repeats',
            '_status': 'submitted_via_web',
            '_tags': '',
            '_notes': '',
            "_submitted_by": 'bob',
            'name': 'Abe',
            'age': '88',
            'has_children': '1',
            '_attachments': [],
            'children[1]/childs_info/name': 'Cain',
            'children[2]/childs_info/name': 'Abel',
            'children[1]/childs_info/age': '56',
            'children[2]/childs_info/age': '48',
            'children[1]/immunization/immunization_received/polio_1': True,
            'children[1]/immunization/immunization_received/polio_2': False,
            'children[2]/immunization/immunization_received/polio_1': True,
            'children[2]/immunization/immunization_received/polio_2': True,
            'web_browsers/chrome': True,
            'web_browsers/firefox': False,
            'web_browsers/ie': False,
            'web_browsers/safari': False,
            'gps': '-1.2626156 36.7923571 0.0 30.0',
            '_geolocation': [-1.2626156, 36.7923571],
            '_gps_latitude': '-1.2626156',
            '_gps_longitude': '36.7923571',
            '_gps_altitude': '0.0',
            '_gps_precision': '30.0',
            '_validation_status': {},
        }
        self.maxDiff = None
        self.assertEqual(data_0, expected_data_0)

    # todo: test nested repeats as well on xls
    def test_xls_groups_within_repeats(self):
        self._publish_xls_fixture_set_xform("groups_in_repeats")
        self._submit_fixture_instance("groups_in_repeats", "01")
        dd = self.xform.data_dictionary()
        dd.get_keys()
        data = self._xls_data_for_dataframe()
        # remove dynamic fields
        ignore_list = [
            '_uuid', 'meta/instanceID', 'formhub/uuid', '_submission_time',
            '_id'
        ]
        for item in ignore_list:
            # pop unwanted keys from main section
            for d in data["groups_in_repeats"]:
                if item in d:
                    d.pop(item)
            # pop unwanted keys from children's section
            for d in data["children"]:
                if item in d:
                    d.pop(item)
        # todo: add _id to xls export
        expected_data = {
            "groups_in_repeats":
            [
                {
                    'picture': None,
                    'has_children': '1',
                    'name': 'Abe',
                    'age': '88',
                    'web_browsers/chrome': True,
                    'web_browsers/safari': False,
                    'web_browsers/ie': False,
                    'web_browsers/firefox': False,
                    'gps': '-1.2626156 36.7923571 0.0 30.0',
                    '_gps_latitude': '-1.2626156',
                    '_gps_longitude': '36.7923571',
                    '_gps_altitude': '0.0',
                    '_gps_precision': '30.0',
                    '_index': 1,
                    '_parent_table_name': None,
                    '_parent_index': -1,
                    '_tags': [],
                    '_notes': [],
                    '_validation_status': {}
                }
            ],
            "children": [
                {
                    'children/childs_info/name': 'Cain',
                    'children/childs_info/age': '56',
                    'children/immunization/immunization_received/polio_1':
                    True,
                    'children/immunization/immunization_received/polio_2':
                    False,
                    '_index': 1,
                    '_parent_table_name': 'groups_in_repeats',
                    '_parent_index': 1,
                },
                {
                    'children/childs_info/name': 'Able',
                    'children/childs_info/age': '48',
                    'children/immunization/immunization_received/polio_1':
                    True,
                    'children/immunization/immunization_received/polio_2':
                    True,
                    '_index': 2,
                    '_parent_table_name': 'groups_in_repeats',
                    '_parent_index': 1,
                }
            ]
        }
        self.maxDiff = None
        self.assertEqual(
            data["groups_in_repeats"][0],
            expected_data["groups_in_repeats"][0])
        # each of the children should have children/... keys, we can guratnee
        # the order so we cant check the values, just make sure they are not
        # none
        self.assertEqual(len(data["children"]), 2)
        for child in data["children"]:
            self.assertTrue("children/childs_info/name" in child)
            self.assertIsNotNone(child["children/childs_info/name"])
            self.assertTrue("children/childs_info/age" in child)
            self.assertIsNotNone(child["children/childs_info/name"])
            self.assertTrue(
                "children/immunization/immunization_received/polio_1" in child)
            self.assertEqual(type(child[
                "children/immunization/immunization_received/polio_1"]), bool)
            self.assertTrue(
                "children/immunization/immunization_received/polio_2" in child)
            self.assertEqual(type(child[
                "children/immunization/immunization_received/polio_2"]), bool)
