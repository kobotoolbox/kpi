# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import xlrd
import datetime
import unittest
from collections import defaultdict

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase

from kobo.apps.reports import report_data
from formpack import FormPack

from kpi.models import Asset, ExportTask


class MockDataExports(TestCase):
    fixtures = ['test_data']

    form_content = {
         'choices': [{'$autovalue': 'spherical',
                       '$kuid': 'jfDnpH2n9',
                       'label': ['Spherical', 'Esf\xe9rico'],
                       'list_name': 'symmetry',
                       'name': 'spherical'},
                      {'$autovalue': 'radial',
                       '$kuid': '07Wr5ehxt',
                       'label': ['Radial', 'Radial'],
                       'list_name': 'symmetry',
                       'name': 'radial'},
                      {'$autovalue': 'bilateral',
                       '$kuid': 'vn5m3TZkF',
                       'label': ['Bilateral', 'Bilateral'],
                       'list_name': 'symmetry',
                       'name': 'bilateral'},
                      {'$autovalue': 'yes',
                       '$kuid': 'thb0B532I',
                       'label': ['Yes', 'S\xed'],
                       'list_name': 'fluids',
                       'name': 'yes'},
                      {'$autovalue': 'yes__and_some_',
                       '$kuid': 'WrTMETvzY',
                       'label': ['Yes, and some extracellular space',
                                  'S\xed, y alg\xfan espacio extracelular'],
                       'list_name': 'fluids',
                       'name': 'yes__and_some_'},
                      {'$autovalue': 'no___unsure',
                       '$kuid': 'i1KtAuy3a',
                       'label': ['No / Unsure', 'No / Inseguro'],
                       'list_name': 'fluids',
                       'name': 'no___unsure'},
                      {'$autovalue': 'yes',
                       '$kuid': 'QfrYJgSNH',
                       'label': ['Yes', 'S\xed'],
                       'list_name': 'yes_no',
                       'name': 'yes'},
                      {'$autovalue': 'no',
                       '$kuid': 'KzgCswpU2',
                       'label': ['No', 'No'],
                       'list_name': 'yes_no',
                       'name': 'no'}],
         'schema': '1',
         'settings': {'id_string': 'Identificaci_n_de_animales'},
         'survey': [{'$autoname': 'start',
                      '$kuid': 'df516ecd',
                      'name': 'start',
                      'type': 'start'},
                     {'$autoname': 'end',
                      '$kuid': '7b054499',
                      'name': 'end',
                      'type': 'end'},
                     {'$autoname': 'external_characteristics',
                      '$kuid': 'cbc4ba77',
                      'label': ['External Characteristics',
                                 'Caracter\xedsticas externas'],
                      'name': 'external_characteristics',
                      'type': 'begin_group'},
                     {'$autoname': 'What_kind_of_symmetry_do_you_have',
                      '$kuid': 'f073bdb4',
                      'label': ['What kind of symmetry do you have?',
                                 '\xbfQu\xe9 tipo de simetr\xeda tiene?'],
                      'name': 'What_kind_of_symmetry_do_you_have',
                      'required': False,
                      'select_from_list_name': 'symmetry',
                      'tags': ['hxl:#symmetry'],
                      'type': 'select_multiple'},
                     {'$autoname': 'How_many_segments_does_your_body_have',
                      '$kuid': '2b4d8728',
                      'label': ['How many segments does your body have?',
                                 '\xbfCu\xe1ntos segmentos tiene tu cuerpo?'],
                      'name': 'How_many_segments_does_your_body_have',
                      'required': False,
                      'tags': ['hxl:#segments'],
                      'type': 'integer'},
                     {'$kuid': '56d0cd68', 'type': 'end_group'},
                     {'$autoname': 'Do_you_have_body_flu_intracellular_space',
                      '$kuid': '5fa1fc59',
                      'label': ['Do you have body fluids that occupy intracellular space?',
                                 '\xbfTienes fluidos corporales que ocupan espacio intracelular?'],
                      'name': 'Do_you_have_body_flu_intracellular_space',
                      'required': False,
                      'select_from_list_name': 'fluids',
                      'tags': ['hxl:#fluids'],
                      'type': 'select_one'},
                     {'$autoname': 'Do_you_descend_from_unicellular_organism',
                      '$kuid': 'bfde6907',
                      'label': ['Do you descend from an ancestral unicellular organism?',
                                 '\xbfDesciende de un organismo unicelular ancestral?'],
                      'name': 'Do_you_descend_from_unicellular_organism',
                      'required': False,
                      'select_from_list_name': 'yes_no',
                      'type': 'select_one'}],
         'translated': ['label'],
         'translations': ['English', 'Spanish']
    }

    submissions = [
        {'Do_you_descend_from_unicellular_organism': 'no',
         'Do_you_have_body_flu_intracellular_space': 'yes__and_some_',
         '_attachments': [],
         '_bamboo_dataset_id': '',
         '_geolocation': [None, None],
         '_id': 61,
         '_notes': [],
         '_status': 'submitted_via_web',
         '_submission_time': '2017-10-23T09:41:19',
         '_submitted_by': None,
         '_tags': [],
         '_uuid': '48583952-1892-4931-8d9c-869e7b49bafb',
         '_xform_id_string': 'aX6CUrtnHfZE64CnNdjzuz',
         'end': '2017-10-23T05:41:13.000-04:00',
         'external_characteristics/How_many_segments_does_your_body_have': '6',
         'external_characteristics/What_kind_of_symmetry_do_you_have': 'spherical radial bilateral',
         'formhub/uuid': '1511083383a64c9dad1eca3795cd3788',
         'meta/instanceID': 'uuid:48583952-1892-4931-8d9c-869e7b49bafb',
         'start': '2017-10-23T05:40:39.000-04:00'},
        {'Do_you_descend_from_unicellular_organism': 'no',
         'Do_you_have_body_flu_intracellular_space': 'yes',
         '_attachments': [],
         '_bamboo_dataset_id': '',
         '_geolocation': [None, None],
         '_id': 62,
         '_notes': [],
         '_status': 'submitted_via_web',
         '_submission_time': '2017-10-23T09:41:38',
         '_submitted_by': None,
         '_tags': [],
         '_uuid': '317ba7b7-bea4-4a8c-8620-a483c3079c4b',
         '_xform_id_string': 'aX6CUrtnHfZE64CnNdjzuz',
         'end': '2017-10-23T05:41:32.000-04:00',
         'external_characteristics/How_many_segments_does_your_body_have': '3',
         'external_characteristics/What_kind_of_symmetry_do_you_have': 'radial',
         'formhub/uuid': '1511083383a64c9dad1eca3795cd3788',
         'meta/instanceID': 'uuid:317ba7b7-bea4-4a8c-8620-a483c3079c4b',
         'start': '2017-10-23T05:41:14.000-04:00'},
        {'Do_you_descend_from_unicellular_organism': 'yes',
         'Do_you_have_body_flu_intracellular_space': 'no___unsure',
         '_attachments': [],
         '_bamboo_dataset_id': '',
         '_geolocation': [None, None],
         '_id': 63,
         '_notes': [],
         '_status': 'submitted_via_web',
         '_submission_time': '2017-10-23T09:42:11',
         '_submitted_by': None,
         '_tags': [],
         '_uuid': '3f15cdfe-3eab-4678-8352-7806febf158d',
         '_xform_id_string': 'aX6CUrtnHfZE64CnNdjzuz',
         'end': '2017-10-23T05:42:05.000-04:00',
         'external_characteristics/How_many_segments_does_your_body_have': '2',
         'external_characteristics/What_kind_of_symmetry_do_you_have': 'bilateral',
         'formhub/uuid': '1511083383a64c9dad1eca3795cd3788',
         'meta/instanceID': 'uuid:3f15cdfe-3eab-4678-8352-7806febf158d',
         'start': '2017-10-23T05:41:32.000-04:00'}
    ]

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(
            name='Identificación de animales',
            content=self.form_content,
            owner=self.user
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        v_uid = self.asset.latest_deployed_version.uid
        for submission in self.submissions:
            submission.update({
                '__version__': v_uid
            })
            self.asset.deployment._mock_submission(submission)
        self.asset.save(create_version=False)
        self.formpack, self.submission_stream = report_data.build_formpack(
            self.asset,
            submission_stream=self.asset.deployment._get_submissions()
        )

    def run_csv_export_test(self, expected_lines, export_options=None):
        '''
        Repeat yourself less while writing CSV export tests.

        `expected_lines`: a list of strings *without* trailing newlines whose
                          UTF-8 encoded representation should match the export
                          result
        `export_options`: a list of extra options for `ExportTask.data`. Do not
                          include `source` or `type`
        '''
        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'csv'
        }
        if export_options:
            export_task.data.update(export_options)
        messages = defaultdict(list)
        export_task._run_task(messages)
        expected_lines = [
            (line + '\r\n').encode('utf-8') for line in expected_lines
        ]
        result_lines = list(export_task.result)
        self.assertEqual(result_lines, expected_lines)
        self.assertFalse(messages)

    def test_csv_export_default_options(self):
        # FIXME: Is this right? English is listed as the first translation
        expected_lines = [
            '"start";"end";"¿Qué tipo de simetría tiene?";"¿Qué tipo de simetría tiene?/Esférico";"¿Qué tipo de simetría tiene?/Radial";"¿Qué tipo de simetría tiene?/Bilateral";"¿Cuántos segmentos tiene tu cuerpo?";"¿Tienes fluidos corporales que ocupan espacio intracelular?";"¿Desciende de un organismo unicelular ancestral?";"_id";"_uuid";"_submission_time";"_index"',
            '"";"";"#symmetry";"#symmetry";"#symmetry";"#symmetry";"#segments";"#fluids";"";"";"";"";""',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Esférico Radial Bilateral";"1";"1";"1";"6";"Sí, y algún espacio extracelular";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Sí";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Inseguro";"Sí";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines)

    def test_csv_export_english_labels(self):
        export_options = {
            'lang': 'English',
        }
        expected_lines = [
            '"start";"end";"What kind of symmetry do you have?";"What kind of symmetry do you have?/Spherical";"What kind of symmetry do you have?/Radial";"What kind of symmetry do you have?/Bilateral";"How many segments does your body have?";"Do you have body fluids that occupy intracellular space?";"Do you descend from an ancestral unicellular organism?";"_id";"_uuid";"_submission_time";"_index"',
            '"";"";"#symmetry";"#symmetry";"#symmetry";"#symmetry";"#segments";"#fluids";"";"";"";"";""',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Spherical Radial Bilateral";"1";"1";"1";"6";"Yes, and some extracellular space";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Yes";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Unsure";"Yes";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines, export_options)

    def test_csv_export_spanish_labels(self):
        export_options = {
            'lang': 'Spanish',
        }
        expected_lines = [
            '"start";"end";"¿Qué tipo de simetría tiene?";"¿Qué tipo de simetría tiene?/Esférico";"¿Qué tipo de simetría tiene?/Radial";"¿Qué tipo de simetría tiene?/Bilateral";"¿Cuántos segmentos tiene tu cuerpo?";"¿Tienes fluidos corporales que ocupan espacio intracelular?";"¿Desciende de un organismo unicelular ancestral?";"_id";"_uuid";"_submission_time";"_index"',
            '"";"";"#symmetry";"#symmetry";"#symmetry";"#symmetry";"#segments";"#fluids";"";"";"";"";""',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Esférico Radial Bilateral";"1";"1";"1";"6";"Sí, y algún espacio extracelular";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Sí";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Inseguro";"Sí";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines, export_options)

    def test_csv_export_english_labels_no_hxl(self):
        export_options = {
            'lang': 'English',
            'tag_cols_for_header': [],
        }
        expected_lines = [
            '"start";"end";"What kind of symmetry do you have?";"What kind of symmetry do you have?/Spherical";"What kind of symmetry do you have?/Radial";"What kind of symmetry do you have?/Bilateral";"How many segments does your body have?";"Do you have body fluids that occupy intracellular space?";"Do you descend from an ancestral unicellular organism?";"_id";"_uuid";"_submission_time";"_index"',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Spherical Radial Bilateral";"1";"1";"1";"6";"Yes, and some extracellular space";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Yes";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Unsure";"Yes";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines, export_options)

    def test_csv_export_english_labels_group_sep(self):
        # Even though we are skipping the `hierarchy_in_labels` tests, we can
        # still check `group_sep` by looking at the `select_multiple` question
        export_options = {
            'lang': 'English',
            'group_sep': '%',
        }
        expected_lines = [
            '"start";"end";"What kind of symmetry do you have?";"What kind of symmetry do you have?%Spherical";"What kind of symmetry do you have?%Radial";"What kind of symmetry do you have?%Bilateral";"How many segments does your body have?";"Do you have body fluids that occupy intracellular space?";"Do you descend from an ancestral unicellular organism?";"_id";"_uuid";"_submission_time";"_index"',
            '"";"";"#symmetry";"#symmetry";"#symmetry";"#symmetry";"#segments";"#fluids";"";"";"";"";""',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Spherical Radial Bilateral";"1";"1";"1";"6";"Yes, and some extracellular space";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Yes";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Unsure";"Yes";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines, export_options)

    @unittest.skip('Enable after fixing formpack#136')
    def test_csv_export_hierarchy_in_labels(self):
        export_options = {'hierarchy_in_labels': 'true'}
        expected_lines = [
            '"start";"end";"Características externas/¿Qué tipo de simetría tiene?";"Características externas/¿Qué tipo de simetría tiene?/Esférico";"Características externas/¿Qué tipo de simetría tiene?/Radial";"Características externas/¿Qué tipo de simetría tiene?/Bilateral";"Características externas/¿Cuántos segmentos tiene tu cuerpo?";"¿Tienes fluidos corporales que ocupan espacio intracelular?";"¿Desciende de un organismo unicelular ancestral?";"_id";"_uuid";"_submission_time";"_index"',
            '"";"";"#symmetry";"#symmetry";"#symmetry";"#symmetry";"#segments";"#fluids";"";"";"";"";""',
            '"2017-10-23T05:40:39.000-04:00";"2017-10-23T05:41:13.000-04:00";"Esférico Radial Bilateral";"1";"1";"1";"6";"Sí, y algún espacio extracelular";"No";"61";"48583952-1892-4931-8d9c-869e7b49bafb";"2017-10-23T09:41:19";"1"',
            '"2017-10-23T05:41:14.000-04:00";"2017-10-23T05:41:32.000-04:00";"Radial";"0";"1";"0";"3";"Sí";"No";"62";"317ba7b7-bea4-4a8c-8620-a483c3079c4b";"2017-10-23T09:41:38";"2"',
            '"2017-10-23T05:41:32.000-04:00";"2017-10-23T05:42:05.000-04:00";"Bilateral";"0";"0";"1";"2";"No / Inseguro";"Sí";"63";"3f15cdfe-3eab-4678-8352-7806febf158d";"2017-10-23T09:42:11";"3"',
        ]
        self.run_csv_export_test(expected_lines, export_options)

    def test_xls_export_english_labels(self):
        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'xls',
            'lang': 'English',
        }
        messages = defaultdict(list)
        export_task._run_task(messages)
        self.assertFalse(messages)

        expected_rows = [
            ['start', 'end', 'What kind of symmetry do you have?', 'What kind of symmetry do you have?/Spherical', 'What kind of symmetry do you have?/Radial', 'What kind of symmetry do you have?/Bilateral', 'How many segments does your body have?', 'Do you have body fluids that occupy intracellular space?', 'Do you descend from an ancestral unicellular organism?', '_id', '_uuid', '_submission_time', '_index'],
            ['', '', '#symmetry', '#symmetry', '#symmetry', '#symmetry', '#segments', '#fluids', '', '', '', '', ''],
            ['2017-10-23T05:40:39.000-04:00', '2017-10-23T05:41:13.000-04:00', 'Spherical Radial Bilateral', '1', '1', '1', '6', 'Yes, and some extracellular space', 'No', 61.0, '48583952-1892-4931-8d9c-869e7b49bafb', '2017-10-23T09:41:19', 1.0],
            ['2017-10-23T05:41:14.000-04:00', '2017-10-23T05:41:32.000-04:00', 'Radial', '0', '1', '0', '3', 'Yes', 'No', 62.0, '317ba7b7-bea4-4a8c-8620-a483c3079c4b', '2017-10-23T09:41:38', 2.0],
            ['2017-10-23T05:41:32.000-04:00', '2017-10-23T05:42:05.000-04:00', 'Bilateral', '0', '0', '1', '2', 'No / Unsure', 'Yes', 63.0, '3f15cdfe-3eab-4678-8352-7806febf158d', '2017-10-23T09:42:11', 3.0],
        ]
        book = xlrd.open_workbook(file_contents=export_task.result.read())
        self.assertEqual(book.sheet_names(), [self.asset.name])
        sheet = book.sheets()[0]
        self.assertEqual(sheet.nrows, len(expected_rows))
        row_index = 0
        for expected_row in expected_rows:
            result_row = [cell.value for cell in sheet.row(row_index)]
            self.assertEqual(result_row, expected_row)
            row_index += 1

    def test_remove_excess(self):
        task_data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'csv',
        }
        # Create and run one export, so we can verify that it's `result` file
        # is later deleted
        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = task_data
        export_task.save()
        export_task.run()
        self.assertEqual(export_task.status, ExportTask.COMPLETE)
        result = export_task.result
        # Make an excessive amount of additional exports
        excess_count = 5 + settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM
        for _ in range(excess_count):
            export_task = ExportTask()
            export_task.user = self.user
            export_task.data = task_data
            export_task.save()
        created_export_tasks = ExportTask._filter_by_source_kludge(
            ExportTask.objects.filter(user=self.user),
            task_data['source']
        )
        self.assertEqual(excess_count + 1, created_export_tasks.count())
        # Identify which exports should be kept
        export_tasks_to_keep = created_export_tasks.order_by('-date_created')[
            :settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM]
        # Call `run()` once more since it invokes the cleanup logic
        export_task.run()
        self.assertEqual(export_task.status, ExportTask.COMPLETE)
        # Verify the cleanup
        self.assertFalse(result.storage.exists(result.path))
        self.assertListEqual( # assertSequenceEqual isn't working...
            list(export_tasks_to_keep.values_list('pk', flat=True)),
            list(ExportTask._filter_by_source_kludge(
                ExportTask.objects.filter(
                    user=self.user),
                task_data['source']
            ).order_by('-date_created').values_list('pk', flat=True))
        )

    def test_log_and_mark_stuck_as_errored(self):
        task_data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'csv',
        }
        self.assertEqual(
            0,
            ExportTask._filter_by_source_kludge(
                ExportTask.objects.filter(
                    user=self.user),
                task_data['source']
            ).count()
        )
        # Simulate a few stuck exports
        for status in (ExportTask.CREATED, ExportTask.PROCESSING):
            export_task = ExportTask()
            export_task.user = self.user
            export_task.data = task_data
            export_task.status = status
            export_task.save()
            export_task.date_created -= datetime.timedelta(days=1)
            export_task.save()
        self.assertSequenceEqual(
            [ExportTask.CREATED, ExportTask.PROCESSING],
            ExportTask._filter_by_source_kludge(
                ExportTask.objects.filter(
                    user=self.user),
                task_data['source']
            ).order_by('pk').values_list('status', flat=True)
        )
        # Run another export, which invokes the cleanup logic
        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = task_data
        export_task.save()
        export_task.run()
        # Verify that the stuck exports have been marked
        self.assertSequenceEqual(
            [ExportTask.ERROR, ExportTask.ERROR, ExportTask.COMPLETE],
            ExportTask._filter_by_source_kludge(
                ExportTask.objects.filter(
                    user=self.user),
                task_data['source']
            ).order_by('pk').values_list('status', flat=True)
        )
