# coding: utf-8
import itertools
from collections import defaultdict

from django.contrib.auth.models import User
from django.urls import reverse
from django.test import TestCase

from kobo.apps.reports import report_data
from kpi.constants import PERM_VIEW_SUBMISSIONS
from kpi.models import Asset, ExportTask
from kpi.utils.strings import to_str


class ConflictingVersionsMockDataExports(TestCase):
    """
    When submissions contain multiple version fields, e.g. the `__version__`,
    `_version_`, and `_version__001` fields included in the
    `conflicting_versions` fixture, make sure that exports pick the NEWEST of
    the versions given by those fields for each submission. Contrast this to
    old behavior where only `__version__` was considered. See
    https://github.com/kobotoolbox/kpi/issues/1500
    """
    fixtures = ['test_data', 'conflicting_versions']

    def setUp(self):
        self.maxDiff = None
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.get(uid='axD3Wc8ZnfgLXBcURRt5fM')
        # To avoid cluttering the fixture, assign permissions here
        self.asset.assign_perm(self.user, PERM_VIEW_SUBMISSIONS)
        self.submissions = self.asset.deployment.get_submissions(
            self.asset.owner)
        self.submission_id_field = '_id'
        self.formpack, self.submission_stream = report_data.build_formpack(
            self.asset,
            submission_stream=self.submissions,
        )
        self.fields_to_inspect = [
            'created_in_first_version',
            'created_in_second_version',
            'created_in_third_version',
            'created_in_fourth_version',
        ]
        self.expected_results = {}
        for sub in self.submissions:
            fields_values = {}
            for field in self.fields_to_inspect:
                try:
                    value = sub[field]
                except KeyError:
                    value = ''
                fields_values[field] = value
            self.expected_results[
                str(sub[self.submission_id_field])
            ] = fields_values

    @staticmethod
    def _split_formpack_csv(line, sep=";", quote='"'):
        return [field.strip(quote) for field in to_str(line).split(sep)]

    def test_csv_export(self):
        """
        Ignores the order of the rows and columns
        """

        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'csv',
            'lang': '_xml'
        }
        messages = defaultdict(list)
        export_task._run_task(messages)
        result_lines = list(export_task.result)
        header = self._split_formpack_csv(result_lines[0])
        field_column_numbers = dict(zip(header, itertools.count()))
        results = {}
        for result_line in result_lines[1:]:
            values = self._split_formpack_csv(result_line)
            fields_values = {}
            for field in self.fields_to_inspect:
                fields_values[field] = values[field_column_numbers[field]]
            sub_id = values[field_column_numbers[self.submission_id_field]]
            results[sub_id] = fields_values
        self.assertEqual(results, self.expected_results)
