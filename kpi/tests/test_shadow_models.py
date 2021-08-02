# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from copy import deepcopy
import json
import datetime


from django.test import TestCase
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import FileField
from mock import MagicMock

from kpi.exceptions import ReadOnlyModelError
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    ReadOnlyKobocatAttachment,
    ReadOnlyKobocatInstance,
)
from kpi.models.asset import Asset


class ShadowModelsTest(TestCase):
    fixtures = ['test_data']
    MEDIA_URL = 'http://localhost:8000' + settings.MEDIA_URL

    def _mockFile(self, filename, size=200):
        media_file = MagicMock(spec=FileField, name='FileMock', absolutespec=True)
        media_file.name = filename
        media_file.url = self.MEDIA_URL.rstrip('/') + filename
        media_file.size = size
        return media_file

    def setUp(self):
        self.now = datetime.datetime.now()
        self.filename = '/path/to/test/image.jpg'
        self.short_filename = self.filename.split('/')[-1]
        self.media_file = self._mockFile(self.filename)

        self.user = User.objects.get(username='someuser')

        asset_survey = [{
            "type": "text",
            "name": "Test_Question",
            "label": "Test Question"
        }, {
            "type": "image",
            "name": "Test_Image_Question",
            "label": "Test Image Question"
        }]

        # Need deepcopy because asset_structure is modified when Asset is created.
        self.questions = json.dumps({'children': deepcopy(asset_survey)})

        self.asset = Asset.objects.create(
            content={
                "survey": asset_survey
            },
            owner=self.user
        )

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.xform = KobocatXForm(
            pk=1,
            id_string=self.asset.uid,
            title='Test XForm',
            user=self.user,
            json=self.questions
        )

        self.instance = ReadOnlyKobocatInstance(
            pk=1,
            id='123',
            uuid='instance_uuid',
            status='test_status',
            xform=self.xform,
            json={'Test_Question': 'Test Answer', 'Test_Image_Question': self.short_filename},
            date_created=self.now,
            date_modified=self.now
        )

        self.attachment = ReadOnlyKobocatAttachment(
            pk=1,
            instance=self.instance,
            media_file=self.media_file,
            mimetype='image/jpeg'
        )

    def test_xform_is_read_only(self):
        with self.assertRaises(ReadOnlyModelError):
            self.xform.save()

    def test_instance_is_read_only(self):
        with self.assertRaises(ReadOnlyModelError):
            self.instance.save()

    def test_attachment_is_read_only(self):
        with self.assertRaises(ReadOnlyModelError):
            self.attachment.save()

    def test_xform_questions_property(self):
        question_json = json.loads(self.questions).get('children', [])
        questions = self.xform.questions
        self.assertIsNotNone(questions)
        self.assertEqual(len(questions), len(question_json))
        for (index, expected) in enumerate(question_json):
            actual = questions[index]
            self.assertEqual(actual['number'], index + 1)
            for field in expected:
                self.assertEqual(actual[field], expected[field])

    def test_instance_submission_property(self):
        submission = self.instance.submission
        self.assertEqual(submission['xform_id'], self.xform.id_string)
        self.assertEqual(submission['id'], self.instance.id)
        self.assertEqual(submission['instance_uuid'], self.instance.uuid)
        self.assertEqual(submission['username'], self.user.username)
        self.assertEqual(submission['status'], self.instance.status)
        self.assertEqual(submission['date_created'], self.instance.date_created)
        self.assertEqual(submission['date_modified'], self.instance.date_modified)

    def test_attachment_properties(self):
        self.assertEqual(self.attachment.filename, self.short_filename)
        self.assertEqual(self.attachment.can_view_submission, True)

    def test_attachment_with_valid_question(self):
        question_name = self.attachment.question_name
        self.assertIsNotNone(question_name)
        self.assertEqual(self.instance.json[question_name], self.short_filename)

        question = self.attachment.question
        self.assertIsNotNone(question)
        self.assertEqual(question['name'], question_name)

        question_index = self.attachment.question_index
        self.assertEqual(question_index, question['number'])

    def test_attachment_with_invalid_question(self):
        # Delete link between Asset and XForm
        id_string = self.xform.id_string
        self.xform.reset_pack()

        self.assertIsNotNone(self.attachment.question_name)
        self.assertIsNone(self.attachment.question)
        self.assertEqual(self.attachment.question_index, self.attachment.pk)

        # Restore link
        self.xform.id_string = id_string
        self.xform.reset_pack()

    def test_attachment_question_does_not_exist(self):
        self.instance.json = {}

        self.assertIsNone(self.attachment.question_name)
        self.assertIsNone(self.attachment.question)
        self.assertEqual(self.attachment.question_index, self.attachment.pk)
