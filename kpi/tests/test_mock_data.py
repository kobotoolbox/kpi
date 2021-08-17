# coding: utf-8
from copy import deepcopy
from collections import OrderedDict

from django.contrib.auth.models import User
from django.test import TestCase

from formpack import FormPack
from kobo.apps.reports import report_data
from kpi.models import Asset

F1 = {'survey': [{'$kuid': 'Uf89NP4VX', 'type': 'start', 'name': 'start'},
                  {'$kuid': 'ZtZBY7XHX', 'type': 'end', 'name': 'end'},
                  {'name': 'Select_one', 'select_from_list_name': 'choice_list_1', 'required': 'true',
                   'label': ['Select one', 'Seleccione uno',
                              '\u0627\u062e\u062a\u0631 \u0648\u0627\u062d\u062f\u0627'], '$kuid': 'WXOeQ4Nc0',
                   'type': 'select_one'},
                  {'name': 'Select_Many', 'select_from_list_name': 'choice_list_2', 'required': 'true',
                   'label': ['Select Many', 'Muchos seleccione',
                              '\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u062f\u064a\u062f'], '$kuid': 'BC6BNP91R',
                   'type': 'select_multiple'},
                  {'$kuid': '0e7sTrQzo', 'required': 'true', 'type': 'text', 'name': 'Text',
                   'label': ['Text', 'Texto', '\u0646\u0635']},
                  {'$kuid': 'ZzKb8DeQu', 'required': 'true', 'type': 'integer', 'name': 'Number',
                   'label': ['Number', 'N\xfamero', '\u0639\u062f\u062f']},
                  {'$kuid': 'gLEDxsNZo', 'required': 'true', 'type': 'decimal', 'name': 'Decimal',
                   'label': ['Decimal', 'Decimal', '\u0639\u062f\u062f \u0639\u0634\u0631\u064a']},
                  {'$kuid': 'pt2w8z3Xk', 'required': 'true', 'type': 'date', 'name': 'Date',
                   'label': ['Date', 'Fecha', '\u062a\u0627\u0631\u064a\u062e']},
                  {'$kuid': '3xn0tP9AI', 'required': 'true', 'type': 'time', 'name': 'Time',
                   'label': ['Time', 'Hora', '\u0645\u0631\u0629']},
                  {'$kuid': 'w0nYPBtT0', 'required': 'true', 'type': 'datetime', 'name': 'Date_and_time',
                   'label': ['Date and time', 'Fecha y hora',
                              '\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648 \u0627\u0644\u0648\u0642\u062a']},
                  {'$kuid': '0dovjhXG6', 'required': 'false', 'type': 'geopoint', 'name': 'GPS',
                   'label': ['GPS', 'GPS',
                              '\u0646\u0638\u0627\u0645 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0645\u0648\u0627\u0642\u0639']},
                  {'$kuid': 'NI2fsrYZI', 'required': 'true', 'type': 'image', 'name': 'Photo',
                   'label': ['Photo', 'Foto',
                              '\u0635\u0648\u0631\u0629 \u0641\u0648\u062a\u0648\u063a\u0631\u0627\u0641\u064a\u0629']},
                  {'$kuid': 'FlfOVztW3', 'required': 'true', 'type': 'audio', 'name': 'Audio',
                   'label': ['Audio', 'Audio', '\u0633\u0645\u0639\u064a']},
                  {'$kuid': 'GdNV76Ily', 'required': 'true', 'type': 'video', 'name': 'Video',
                   'label': ['Video', 'V\xeddeo', '\u0641\u064a\u062f\u064a\u0648']},
                  {'$kuid': 'EDuWkTREB', 'required': 'false', 'type': 'note',
                   'name': 'Note_Should_not_be_displayed',
                   'label': ['Note (Should not be displayed!)', 'Nota (no se represente!)',
                              '\u0645\u0644\u0627\u062d\u0638\u0629 (\u064a\u062c\u0628 \u0623\u0646 \u0644\u0627 \u064a\u062a\u0645 \u0639\u0631\u0636!)']},
                  {'$kuid': 'hwik7tNXF', 'required': 'true', 'type': 'barcode', 'name': 'Barcode',
                   'label': ['Barcode', 'C\xf3digo de barras', '\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f']},
                  {'$kuid': 'NTBElbRcj', 'required': 'true', 'type': 'acknowledge', 'name': 'Acknowledge',
                   'label': ['Acknowledge', 'Reconocer', '\u0627\u0639\u062a\u0631\u0641']},
                  {'calculation': '1', '$kuid': 'x6zr1MtmP', 'required': 'false', 'type': 'calculate',
                   'name': 'calculation'}], 'translations': [None, 'Espa\xf1ol', 'Arabic'], 'choices': [
    {'$kuid': 'xm4h0m4kK', 'list_name': 'choice_list_1', 'name': 'option_1',
     'label': ['First option', 'Primera opci\xf3n',
                '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644']},
    {'$kuid': 'slcf0IezR', 'list_name': 'choice_list_1', 'name': 'option_2',
     'label': ['Second option', 'Segunda opci\xf3n',
                '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a']},
    {'$kuid': 'G7myzY2qX', 'list_name': 'choice_list_2', 'name': 'option_1',
     'label': ['First option', 'Primera opci\xf3n',
                '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644']},
    {'$kuid': 'xUd28PPBs', 'list_name': 'choice_list_2', 'name': 'option_2',
     'label': ['Second option', 'Segunda opci\xf3n',
                '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a']}]}

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
        self.asset.deployment.mock_submissions(submissions)
        schemas = [v.to_formpack_schema() for v in self.asset.deployed_versions]
        self.fp = FormPack(versions=schemas, id_string=self.asset.uid)
        self.vs = self.fp.versions.keys()
        self.submissions = self.asset.deployment.get_submissions(self.user)

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
            ('2016-06-01',
             {'responses': ('First option', 'Second option'),
              'frequencies': (1, 0),
              'percentages': (25.0, 0.0)}),
            ('2016-06-02',
             {'responses': ('First option', 'Second option'),
              'frequencies': (1, 0),
              'percentages': (25.0, 0.0)}),
            ('2016-06-03',
             {'responses': ('First option', 'Second option'),
              'frequencies': (0, 1),
              'percentages': (0.0, 25.0)}),
            ('2016-06-05',
             {'responses': ('First option', 'Second option'),
              'frequencies': (1, 0),
              'percentages': (25.0, 0.0)}),
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
        expected = set(['\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644',
                        '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a'])
        self.assertEqual(responses, expected)

    def test_kobo_apps_reports_report_data_subset(self):
        values = report_data.data_by_identifiers(self.asset,
                                                 field_names=('Select_one',),
                                                 submission_stream=self.submissions)
        self.assertEqual(values[0]['data']['frequencies'], (3, 1))
        self.assertEqual(values[0]['row']['type'], 'select_one')
        self.assertEqual(values[0]['data']['percentages'], (75, 25))
        self.assertEqual(values[0]['data']['responses'], ('First option', 'Second option'))

    def test_kobo_apps_reports_report_data_translation(self):
        values = report_data.data_by_identifiers(self.asset,
                                                 lang='Arabic',
                                                 field_names=('Select_one',),
                                                 submission_stream=self.submissions)
        self.assertEqual(values[0]['data']['responses'],
                         (  # response 1 in Arabic
                             '\u0627\u0644\u062e\u064a\u0627\u0631 '
                             '\u0627\u0644\u0623\u0648\u0644',
                             # response 2 in Arabic
                             '\u0627\u0644\u062e\u064a\u0627\u0631 '
                             '\u0627\u0644\u062b\u0627\u0646\u064a'))

    def test_export_works_if_no_version_value_provided_in_submission(self):
        submissions = self.asset.deployment.get_submissions(self.asset.owner)

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
            'provided': 4,
            'frequencies': (1, 1, 1, 1),
            'show_graph': True,
            'not_provided': 0,
            'total_count': 4,
            'responses': ('2016-06-01', '2016-06-02', '2016-06-03', '2016-06-05'),
            'percentages': (25.0, 25.0, 25.0, 25.0),
        })

    def test_has_report_styles(self):
        self.assertTrue(self.asset.report_styles is not None)

    def test_formpack_results(self):
        submissions = self.asset.deployment.get_submissions(self.asset.owner)

        def _get_autoreport_values(qname, key, lang=None, index=False):
            stats = OrderedDict(_get_stats_object(self.fp,
                                                  self.vs,
                                                  submissions=submissions,
                                                  lang=lang))
            if index is False:
                return stats[qname][key]
            else:
                return [s[index] for s in stats[qname][key]]

        self.assertEqual(_get_autoreport_values('Select_one', 'frequency', None, 0),
                         ['First option', 'Second option'])
        self.assertEqual(_get_autoreport_values('Select_one', 'frequency', 'Espa\xf1ol', 0),
                         ['Primera opci\xf3n', 'Segunda opci\xf3n'])
        self.assertEqual(_get_autoreport_values('Select_one', 'frequency', 'Arabic', 0),
                         ['\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0623\u0648\u0644',
                          '\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a'])

        self.assertEqual(_get_autoreport_values('Decimal', 'median', None), 3.0)
        self.assertEqual(_get_autoreport_values('Date', 'percentage', None), [
            ("2016-06-01", 25.0),
            ("2016-06-02", 25.0),
            ("2016-06-03", 25.0),
            ("2016-06-05", 25.0)
        ])

    def test_has_version_and_submissions(self):
        self.assertEqual(self.asset.asset_versions.count(), 2)
        self.assertTrue(self.asset.has_deployment)
        self.assertEqual(self.asset.deployment.submission_count, 4)
