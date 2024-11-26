# coding: utf-8
import os
from datetime import datetime, timedelta, date
from unittest.mock import patch

from django.conf import settings

from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.data.query import get_form_submissions_grouped_by_field,\
    get_date_fields, get_field_records


class TestTools(TestBase):

    def setUp(self):
        super().setUp()
        self._create_user_and_login()
        self._publish_transportation_form()

    @patch('django.utils.timezone.now')
    def test_get_form_submissions_grouped_by_field(self, mock_time):
        mock_time.return_value = datetime.now()
        self._make_submissions()

        count_key = 'count'
        fields = ['_submission_time', '_xform_id_string']

        count = len(self.xform.instances.all())

        for field in fields:
            result = get_form_submissions_grouped_by_field(
                self.xform, field)[0]

            self.assertEqual([field, count_key], sorted(result.keys()))
            self.assertEqual(result[count_key], count)

    @patch('django.utils.timezone.now')
    @patch('kobo.apps.openrosa.apps.logger.models.instance.submission_time')
    def test_get_form_submissions_grouped_by_field_datetime_to_date(
            self, mock_date_created, mock_time):
        now = datetime(2014, 1, 1)
        mock_time.side_effect = lambda: now
        mock_date_created.return_value = now
        self._make_submissions()

        count_key = 'count'
        fields = ['_submission_time']

        count = len(self.xform.instances.all())

        for field in fields:
            result = get_form_submissions_grouped_by_field(
                self.xform, field)[0]

            self.assertEqual([field, count_key], sorted(result.keys()))

            expected_now = now.date()
            if not isinstance(result[field], date):
                expected_now = str(expected_now)

            self.assertEqual(result[field], expected_now)
            self.assertEqual(result[count_key], count)

    @patch('django.utils.timezone.now')
    def test_get_form_submissions_two_xforms(self, mock_time):
        mock_time.return_value = datetime.now()
        self._make_submissions()
        self._publish_xls_file(os.path.join(
            "fixtures",
            "gps", "gps.xls"))

        first_xform = self.xform
        self.xform = self.user.xforms.all().order_by('-pk')[0]

        self._make_submission(
            os.path.join(
                settings.OPENROSA_APP_DIR,
                'apps',
                'main',
                'tests',
                'fixtures',
                'gps',
                'instances',
                'gps_1980-01-23_20-52-08.xml',
            )
        )

        count_key = 'count'
        fields = ['_submission_time', '_xform_id_string']

        count = len(self.xform.instances.all())

        for field in fields:
            result = get_form_submissions_grouped_by_field(
                self.xform, field)[0]

            self.assertEqual([field, count_key], sorted(result.keys()))
            self.assertEqual(result[count_key], count)

        count = len(first_xform.instances.all())

        for field in fields:
            result = get_form_submissions_grouped_by_field(
                first_xform, field)[0]

            self.assertEqual([field, count_key], sorted(result.keys()))
            self.assertEqual(result[count_key], count)

    @patch('django.utils.timezone.now')
    def test_get_form_submissions_xform_no_submissions(self, mock_time):
        mock_time.return_value = datetime.now()
        self._make_submissions()
        self._publish_xls_file(os.path.join(
            "fixtures",
            "gps", "gps.xls"))

        self.xform = self.user.xforms.all().order_by('-pk')[0]

        fields = ['_submission_time', '_xform_id_string']

        count = len(self.xform.instances.all())
        self.assertEqual(count, 0)
        for field in fields:
            result = get_form_submissions_grouped_by_field(
                self.xform, field)
            self.assertEqual(result, [])

    @patch('django.utils.timezone.now')
    def test_get_form_submissions_grouped_by_field_sets_name(self, mock_time):
        mock_time.return_value = datetime.now()
        self._make_submissions()

        count_key = 'count'
        fields = ['_submission_time', '_xform_id_string']
        name = '_my_name'

        xform = self.user.xforms.all()[0]
        count = len(xform.instances.all())

        for field in fields:
            result = get_form_submissions_grouped_by_field(
                xform, field, name)[0]

            self.assertEqual([name, count_key], sorted(result.keys()))
            self.assertEqual(result[count_key], count)

    def test_get_form_submissions_when_response_not_provided(self):
        """
        Test that the None value is stripped when of the submissions
        doesnt have a response for the specified field
        """
        self._make_submissions()

        count = Instance.objects.count()

        # make submission that doesnt have a response for
        # `available_transportation_types_to_referral_facility`
        path = os.path.join(
            self.this_directory, 'fixtures', 'transportation',
            'instances', 'transport_no_response', 'transport_no_response.xml')
        self._make_submission(path, self.user.username)
        self.assertEqual(Instance.objects.count(), count + 1)

        field = 'transport/available_transportation_types_to_referral_facility'
        xform = self.user.xforms.all()[0]

        results = get_form_submissions_grouped_by_field(
            xform, field,
            'available_transportation_types_to_referral_facility')

        # we should have a similar number of aggregates as submissions as each
        # submission has a unique value for the field
        self.assertEqual(len(results), count + 1)

        # the count where the value is None should have a count of 1
        result = [r for r in results
                  if r['available_transportation_types_to_referral_facility'] is None][0]
        self.assertEqual(result['count'], 1)

    def test_get_date_fields_includes_start_end(self):
        path = os.path.join(
            os.path.dirname(__file__), 'fixtures', 'tutorial', 'tutorial.xls'
        )
        self._publish_xls_file_and_set_xform(path)
        fields = get_date_fields(self.xform)
        expected_fields = sorted(
            ['_submission_time', 'date', 'start_time', 'end_time', 'today',
             'exactly'])
        self.assertEqual(sorted(fields), expected_fields)

    def test_get_field_records_when_some_responses_are_empty(self):
        submissions = ['1', '2', '3', 'no_age']
        path = os.path.join(
            os.path.dirname(__file__), 'fixtures', 'tutorial', 'tutorial.xls'
        )
        self._publish_xls_file_and_set_xform(path)

        for i in submissions:
            self._make_submission(
                os.path.join(
                    settings.OPENROSA_APP_DIR,
                    'apps',
                    'api',
                    'tests',
                    'fixtures',
                    'forms',
                    'tutorial',
                    'instances',
                    '{}.xml'.format(i),
                )
            )

        field = 'age'
        records = get_field_records(field, self.xform)
        self.assertEqual(sorted(records), sorted([23, 23, 35]))
