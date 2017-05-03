# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from copy import deepcopy
import json
from collections import OrderedDict

from django.contrib.auth.models import User
from django.test import TestCase

from kobo.apps.reports import report_data
from formpack import FormPack

from kpi.models import Asset

from formpack.utils import json_hash

F1 = {u'survey': [{u'$kuid': u'Uf89NP4VX', u'type': u'start', u'name': u'start'}, {u'$kuid': u'ZtZBY7XHX', u'type': u'end', u'name': u'end'}, {u'name': u'Select_one', u'select_from_list_name': u'choice_list_1', u'required': u'true', u'label': [u'Select one', u'Seleccione uno', u'\u0627\u062e\u062a\u0631 \u0648\u0627\u062d\u062f\u0627'], u'$kuid': u'WXOeQ4Nc0', u'type': u'select_one'}, {u'name': u'Select_Many', u'select_from_list_name': u'choice_list_2', u'required': u'true', u'label': [u'Select Many', u'Muchos seleccione', u'\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u062f\u064a\u062f'], u'$kuid': u'BC6BNP91R', u'type': u'select_multiple'}, {u'$kuid': u'0e7sTrQzo', u'required': u'true', u'type': u'text', u'name': u'Text', u'label': [u'Text', u'Texto', u'\u0646\u0635']}, {u'$kuid': u'ZzKb8DeQu', u'required': u'true', u'type': u'integer', u'name': u'Number', u'label': [u'Number', u'N\xfamero', u'\u0639\u062f\u062f']}, {u'$kuid': u'gLEDxsNZo', u'required': u'true', u'type': u'decimal', u'name': u'Decimal', u'label': [u'Decimal', u'Decimal', u'\u0639\u062f\u062f \u0639\u0634\u0631\u064a']}, {u'$kuid': u'pt2w8z3Xk', u'required': u'true', u'type': u'date', u'name': u'Date', u'label': [u'Date', u'Fecha', u'\u062a\u0627\u0631\u064a\u062e']}, {u'$kuid': u'3xn0tP9AI', u'required': u'true', u'type': u'time', u'name': u'Time', u'label': [u'Time', u'Hora', u'\u0645\u0631\u0629']}, {u'$kuid': u'w0nYPBtT0', u'required': u'true', u'type': u'datetime', u'name': u'Date_and_time', u'label': [u'Date and time', u'Fecha y hora', u'\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648 \u0627\u0644\u0648\u0642\u062a']}, {u'$kuid': u'0dovjhXG6', u'required': u'false', u'type': u'geopoint', u'name': u'GPS', u'label': [u'GPS', u'GPS', u'\u0646\u0638\u0627\u0645 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0648\u0627\u0642\u0639']}, {u'$kuid': u'NI2fsrYZI', u'required': u'true', u'type': u'image', u'name': u'Photo', u'label': [u'Photo', u'Foto', u'\u0635\u0648\u0631\u0629 \u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u0629']}, {u'$kuid': u'FlfOVztW3', u'required': u'true', u'type': u'audio', u'name': u'Audio', u'label': [u'Audio', u'Audio', u'\u0633\u0645\u0639\u064a']}, {u'$kuid': u'GdNV76Ily', u'required': u'true', u'type': u'video', u'name': u'Video', u'label': [u'Video', u'V\xeddeo', u'\u0641\u064a\u062f\u064a\u0648']}, {u'$kuid': u'EDuWkTREB', u'required': u'false', u'type': u'note', u'name': u'Note_Should_not_be_displayed', u'label': [u'Note (Should not be displayed!)', u'Nota (no se represente!)', u'\u0645\u0644\u0627\u062d\u0638\u0629 (\u064a\u062c\u0628 \u0623\u0646 \u0644\u0627 \u064a\u062a\u0645 \u0639\u0631\u0636!)']}, {u'$kuid': u'hwik7tNXF', u'required': u'true', u'type': u'barcode', u'name': u'Barcode', u'label': [u'Barcode', u'C\xf3digo de barras', u'\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f']}, {u'$kuid': u'NTBElbRcj', u'required': u'true', u'type': u'acknowledge', u'name': u'Acknowledge', u'label': [u'Acknowledge', u'Reconocer', u'\u0627\u0639\u062a\u0631\u0641']}, {u'calculation': u'1', u'$kuid': u'x6zr1MtmP', u'required': u'false', u'type': u'calculate', u'name': u'calculation'}], u'translations': [None, u'Espa\xf1ol', u'Arabic'], u'choices': [{u'$kuid': u'xm4h0m4kK', u'list_name': u'choice_list_1', u'name': u'option_1', u'label': [u'First option', u'Primera opci\xf3n', u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644']}, {u'$kuid': u'slcf0IezR', u'list_name': u'choice_list_1', u'name': u'option_2', u'label': [u'Second option', u'Segunda opci\xf3n', u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a']}, {u'$kuid': u'G7myzY2qX', u'list_name': u'choice_list_2', u'name': u'option_1', u'label': [u'First option', u'Primera opci\xf3n', u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644']}, {u'$kuid': u'xUd28PPBs', u'list_name': u'choice_list_2', u'name': u'option_2', u'label': [u'Second option', u'Segunda opci\xf3n', u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a']}]}

SUBMISSION_DATA = OrderedDict([
    ("start",
     ["2016-06-0%dT12:00:00.000-04:00" % n for n in [1, 2, 3, 4]]),
    ("end",
     ["2016-06-0%dT11:0%d:00.000-04:00" % (n, n) for n in [1, 2, 3, 4]]),
    ("Select_one",
     ["option_1", "option_1", "option_2", "option_1"]),
    ("Select_Many",
     ["option_1", "option_2", "option_1 option_2", ""]),
    ("Text",
     ["a", "b", "c", "a"]),
    ("Number",
     [1, 2, 3, 2]),
    ("Decimal",
     [1.5, 2.5, 3.5, 3.5]),
    ("Date",
     ["2016-06-0%d" % n for n in [1, 2, 3, 5]]),
    ("Time",
     ["%d:00:00" % n for n in [1, 2, 3, 5]]),
    ("Date_and_time",
     ["2016-06-0%dT12:00:00.000-04:00" % n for n in [1, 2, 3, 5]]),
    ("GPS",
     ["1%d.43 -2%d.54 1 0" % (n, n) for n in [5, 7, 8, 5]]),
    ("Photo",
     ["photo_%d.jpg" % (n) for n in [1, 2, 3, 4]]),
    ("Audio",
     ["audio_%d.jpg" % (n) for n in [4, 3, 2, 1]]),
    ("Video",
     ["video_%d.jpg" % (n) for n in [6, 7, 8, 9]]),
    ("Note_Should_not_be_displayed",
     [None, None, None, None]),
    ("Barcode",
     ["barcode%d" % (n) for n in [9, 7, 7, 6]]),
    ("Acknowledge",
     [None, None, None, None]),
    ("calculation",
     ["1", "1", "1", "1"]),
])


def _get_stats_object(pack, version_ids, submissions=None, lang=None, split_by=None):
    if submissions == None:
        raise ValueError('submissions must be provided')
    report = pack.autoreport(versions=version_ids)
    field_names = [field.name for field in pack.get_fields_for_versions(-1)]
    stats = []
    for (field, name_or_label, data) in report.get_stats(submissions,
                                                         field_names,
                                                         lang=lang,
                                                         split_by=split_by,
                                                         ).stats:
        stats.append((field.name, data))
    return stats


class MockDataReports(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

        self.asset = Asset.objects.create(content=deepcopy(F1), owner=self.user)

        num_submissions = 4

        submissions = []
        for i in range(0, num_submissions):
            submissions.append(OrderedDict([
                (key, SUBMISSION_DATA[key][i]) for key in SUBMISSION_DATA.keys()
                ]))

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        v_uid = self.asset.latest_deployed_version.uid
        for submission in submissions:
            submission.update({
                '__version__': v_uid
            })
            self.asset.deployment._mock_submission(submission)
        self.asset.save(create_version=False)
        schemas = [v.to_formpack_schema() for v in self.asset.deployed_versions]
        self.fp = FormPack(versions=schemas, id_string=self.asset.uid)
        self.vs = self.fp.versions.keys()
        self.submissions = self.asset.deployment._get_submissions()

    def test_kobo_apps_reports_report_data(self):
        values = report_data.data_by_identifiers(self.asset,
                                          submission_stream=self.submissions)
        expected_names = ["start", "end", "Select_one", "Select_Many", "Text",
                          "Number", "Decimal", "Date", "Time", "Date_and_time",
                          "GPS", "Photo", "Audio", "Video", "Barcode",
                          "Acknowledge", "calculation"]
        self.assertEqual([v['name'] for v in values], expected_names)
        self.assertEqual(len(values), 17)

    def test_kobo_apps_reports_report_data_split_by(self):
        values = report_data.data_by_identifiers(self.asset,
                                          split_by="Select_one",
                                          field_names=["Date"],
                                          submission_stream=self.submissions)
        self.assertEqual(values[0]['data']['values'], [
                (u'2016-06-01',
                  {u'responses': (u'First option', u'Second option'),
                   u'frequencies': (1,             0),
                   u'percentages': (25.0,          0.0)}),
                (u'2016-06-02',
                  {u'responses': (u'First option', u'Second option'),
                   u'frequencies': (1,             0),
                   u'percentages': (25.0,          0.0)}),
                (u'2016-06-03',
                  {u'responses': (u'First option', u'Second option'),
                   u'frequencies': (0,             1),
                   u'percentages': (0.0,           25.0)}),
                (u'2016-06-05',
                  {u'responses': (u'First option', u'Second option'),
                   u'frequencies': (1,              0),
                   u'percentages': (25.0,           0.0)}),
          ])

    def test_kobo_apps_reports_report_data_split_by_translated(self):
        values = report_data.data_by_identifiers(self.asset,
                                                 split_by="Select_one",
                                                 lang="Arabic",
                                                 field_names=["Date"],
                                                 submission_stream=self.submissions)
        responses = set()
        for rv in OrderedDict(values[0]['data']['values']).values():
            responses.update(rv.get('responses'))
        expected = set([u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644',
                             u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a'])
        self.assertEqual(responses, expected)

    def test_kobo_apps_reports_report_data_subset(self):
        values = report_data.data_by_identifiers(self.asset,
                                                 field_names=('Select_one',),
                                                 submission_stream=self.submissions)
        self.assertEqual(values[0]['data']['frequencies'], (3, 1))
        self.assertEqual(values[0]['row']['type'], 'select_one')
        self.assertEqual(values[0]['data']['percentages'], (75, 25))
        self.assertEqual(values[0]['data']['responses'], (u'First option', u'Second option'))

    def test_kobo_apps_reports_report_data_translation(self):
        values = report_data.data_by_identifiers(self.asset,
                                          lang='Arabic',
                                          field_names=('Select_one',),
                                          submission_stream=self.submissions)
        self.assertEqual(values[0]['data']['responses'],
                         (  # response 1 in Arabic
                          u'\u0627\u0644\u062e\u064a\u0627\u0631 '
                          u'\u0627\u0644\u0623\u0648\u0644',
                          # response 2 in Arabic
                          u'\u0627\u0644\u062e\u064a\u0627\u0631 '
                          u'\u0627\u0644\u062b\u0627\u0646\u064a'))

    def test_export_works_if_no_version_value_provided_in_submission(self):
        submissions = self.asset.deployment._get_submissions()

        for submission in submissions:
            del submission['__version__']

        values = report_data.data_by_identifiers(self.asset,
                                                 field_names=['Date', 'Decimal'],
                                                 submission_stream=submissions)

        (date_stats, decimal_stats) = values
        self.assertEqual(date_stats['data'], {
          'provided': 4,
          'total_count': 4,
          'stdev': 0.9574271077563381,
          'median': 3.0,
          'show_graph': False,
          'mode': 3.5,
          'not_provided': 0,
          'mean': 2.75,
        })
        self.assertEqual(decimal_stats['data'], {
            u'provided': 4,
            u'frequencies': (1, 1, 1, 1),
            u'show_graph': True,
            u'not_provided': 0,
            u'total_count': 4,
            u'responses': (u'2016-06-01', u'2016-06-02', u'2016-06-03', u'2016-06-05'),
            u'percentages': (25.0, 25.0, 25.0, 25.0),
        })

    def test_has_report_styles(self):
        self.assertTrue(self.asset.report_styles is not None)

    def test_formpack_results(self):
        submissions = self.asset.deployment._get_submissions()

        def _get_autoreport_values(qname, key, lang=None, index=False):
            stats = OrderedDict(_get_stats_object(self.fp,
                                                  self.vs,
                                                  submissions=submissions,
                                                  lang=lang))
            if index is False:
                return stats[qname][key]
            else:
                return [s[index] for s in stats[qname][key]]

        self.assertEqual(_get_autoreport_values(u'Select_one', u'frequency', None, 0),
                         ['First option', 'Second option'])
        self.assertEqual(_get_autoreport_values('Select_one', u'frequency', u'Espa\xf1ol', 0),
                         [u'Primera opci\xf3n', u'Segunda opci\xf3n'])
        self.assertEqual(_get_autoreport_values(u'Select_one', u'frequency', u'Arabic', 0),
                         [u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644',
                         u'\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a'])

        self.assertEqual(_get_autoreport_values(u'Decimal', u'median', None), 3.0)
        self.assertEqual(_get_autoreport_values(u'Date', u'percentage', None), [
            ("2016-06-01", 25.0),
            ("2016-06-02", 25.0),
            ("2016-06-03", 25.0),
            ("2016-06-05", 25.0)
        ])

    def test_has_version_and_submissions(self):
        self.assertEqual(self.asset.asset_versions.count(), 2)
        self.assertTrue(self.asset.has_deployment)
        self.assertEqual(self.asset.deployment._submission_count(), 4)
