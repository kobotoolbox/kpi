# coding: utf-8

import os
import json
import datetime

from django.test import TestCase, RequestFactory
from django.conf import settings
from django.db.models import FileField
from django.contrib.auth.models import User
from mock import patch, MagicMock
from kpi.models import Asset
from kpi.utils import image_tools
from django_mock_queries.query import MockModel, MockSet
from kpi.views import AttachmentViewSet
from kpi.deployment_backends.kc_reader.shadow_models import _models

class AttachmentViewsetTestCase(TestCase):
    fixtures = ['test_data']

    SAVED_XFORMS = []
    SAVED_INSTANCES = []
    SAVED_ATTACHMENTS = []

    MEDIA_URL = 'http://localhost:8000' + settings.MEDIA_URL

    def _mockFile(self, filename, size=1000):
        media_file = MagicMock(spec=FileField, name='FileMock', absolutespec=True)
        media_file.name = filename
        media_file.url = self.MEDIA_URL.rstrip('/') + filename
        media_file.size = size
        return media_file

    def _generateAsset(self, uid):
        asset = MagicMock(spec=Asset, name='AssetMock', return_value=True)
        asset.pk = 1
        asset.uid = uid
        deployment = MagicMock(name="Deployment")
        deployment.identifier = uid
        asset.deployment = deployment
        asset.has_deployment = True
        return asset

    def _generateXForm(self, id_string, title='Test XForm', user=None, questions=[]):
        xform = _models.XForm(
            pk=len(self.SAVED_XFORMS) + 1,
            id_string=id_string,
            title=title,
            user=user,
            json=json.dumps({'children': questions})
        )
        self.SAVED_XFORMS.append(xform)
        return xform

    def _generateInstance(self, uuid, xform, status='test status', answers={}):
        now = datetime.datetime.now()
        instance = _models.Instance(
            pk=len(self.SAVED_INSTANCES) + 1,
            uuid=uuid,
            status=status,
            xform=xform,
            json=answers,
            date_created=now,
            date_modified=now
        )
        self.SAVED_INSTANCES.append(instance)
        return instance

    def _generateAttachment(self, instance, filename, size=1000, mimetype='image/jpeg'):
        attachment = _models.Attachment(
            pk=len(self.SAVED_ATTACHMENTS) + 1,
            instance=instance,
            media_file=self._mockFile(filename, size),
            mimetype=mimetype
        )
        self.SAVED_ATTACHMENTS.append(attachment)
        return attachment

    def _setUpData(self):
        self.SAVED_XFORMS = []
        self.SAVED_INSTANCES = []
        self.SAVED_ATTACHMENTS = []

        self.filename1 = '/path/to/test/image_one.jpg'
        self.filename2 = '/path/to/test/image_two.jpg'
        self.questions = [{
            'type': 'photo',
            'name': 'Test_Question_One',
            'label': 'Test Question One'
        }, {
            'type': 'photo',
            'name': 'Test_Question_Two',
            'label': 'Test Question Two'
        }]
        self.answers = {
            self.questions[0]['name']: self.filename1.split('/')[-1],
            self.questions[1]['name']: self.filename2.split('/')[-1]
        }
        self.user = User.objects.get(username='someuser')
        self.asset = self._generateAsset('someassetid')

        # Generate one XForm
        self._generateXForm(self.asset.uid, user=self.user, questions=self.questions)

        # Generate two Instances
        self._generateInstance(
            'SOME-INSTANCE-UUID',
            self.SAVED_XFORMS[0],
            answers=self.answers
        )
        self._generateInstance(
            'ANOTHER-INSTANCE-UUID',
            self.SAVED_XFORMS[0],
            answers=self.answers
        )

        # Generate four Attachments
        self._generateAttachment(
            self.SAVED_INSTANCES[0],
            self.filename1
        )
        self._generateAttachment(
            self.SAVED_INSTANCES[0],
            self.filename2
        )
        self._generateAttachment(
            self.SAVED_INSTANCES[1],
            self.filename1
        )
        self._generateAttachment(
            self.SAVED_INSTANCES[1],
            self.filename2
        )

        self.parent_qs = MockSet(self.asset, model=MagicMock(spec=Asset, return_value=True))
        self.qs = MockSet(*self.SAVED_ATTACHMENTS, model=_models.Attachment)

    def setUp(self):
        self._setUpData()
        self.factory = RequestFactory()
        self.retrieve_view = AttachmentViewSet.as_view({
            'get': 'retrieve'
        })
        self.list_view = AttachmentViewSet.as_view({
            'get': 'list'
        })


    def test_list_view(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                url = '/assets/%s/attachmments' % self.asset.uid
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], len(self.SAVED_ATTACHMENTS))
                self.assertIsNone(data['previous'])
                self.assertIsNone(data['next'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNone(data['next_page'])
                self.assertEquals(len(data['results']), len(self.SAVED_ATTACHMENTS))


    def test_list_view_no_results(self):
        empty = MockSet(model=_models.Attachment)
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', empty):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                url = '/assets/%s/attachmments' % self.asset.uid
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], 0)
                self.assertIsNone(data['previous'])
                self.assertIsNone(data['next'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNone(data['next_page'])
                self.assertEquals(len(data['results']), 0)


    def test_list_view_asset_not_found(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            empty = MockSet(model=Asset)
            with patch('kpi.models.Asset.objects', empty):
                url = '/assets/%s/attachmments' % self.asset.uid
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 404)


    @patch('kpi.serializers.image_url', MagicMock(side_effect=lambda att, size: att.media_file.url))
    def test_retrieve_view(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                expected = self.SAVED_ATTACHMENTS[-1]
                pk = expected.pk
                url = '/assets/%s/attachmments/%s' % (self.asset.uid, pk)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(expected.id, data['id'])
                self.assertEquals(expected.media_file.name, data['filename'])
                self.assertEquals(expected.filename, data['short_filename'])
                self.assertEquals(expected.mimetype, data['mimetype'])
                self.assertEquals(expected.media_file.url, data['download_url'])
                self.assertEquals(expected.can_view_submission, data['can_view_submission'])
                self.assertIsNotNone(data['question'])
                self.assertIsNotNone(data['submission'])


    def test_retrieve_view_attachment_not_found(self):
        empty = MockSet(model=_models.Attachment)
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', empty):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                pk = self.SAVED_ATTACHMENTS[-1].pk
                url = '/assets/%s/attachmments/%s' % (self.asset.uid, pk)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 404)


    def test_retrieve_view_asset_not_found(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            empty = MockSet(model=Asset)
            with patch('kpi.models.Asset.objects', empty):
                pk = self.SAVED_ATTACHMENTS[-1].pk
                url = '/assets/%s/attachmments/%s' % (self.asset.uid, pk)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 404)


    def test_list_view_filter_by_type(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                type = 'image'
                url = '/assets/%s/attachmments?type=%s' % (self.asset.uid, type)
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], len(self.SAVED_ATTACHMENTS)) # All attachments have image mimetype
                self.assertIsNone(data['previous'])
                self.assertIsNone(data['next'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNone(data['next_page'])
                self.assertEquals(len(data['results']), len(self.SAVED_ATTACHMENTS))


    def test_list_view_filter_by_non_image_type(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                type = 'survey'
                url = '/assets/%s/attachmments?type=%s' % (self.asset.uid, type)
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], 0) # Non image mimetype returns no results
                self.assertIsNone(data['previous'])
                self.assertIsNone(data['next'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNone(data['next_page'])
                self.assertEquals(len(data['results']), 0)


    def test_list_view_paging(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                page_size = 2
                url = '/assets/%s/attachmments?page_size=%s' % (self.asset.uid, page_size)
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], len(self.SAVED_ATTACHMENTS))
                self.assertIsNone(data['previous'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNotNone(data['next'])
                self.assertTrue('limit=2' in data['next'])
                self.assertTrue('offset=2' in data['next'])
                self.assertIsNotNone(data['next_page'])
                self.assertTrue('page=2' in data['next_page'])
                self.assertTrue('page_size=2' in data['next_page'])
                self.assertEquals(len(data['results']), page_size)


    def test_list_view_group_by_submission(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                group_by = 'submission'
                url = '/assets/%s/attachmments?group_by=%s' % (self.asset.uid, group_by)
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], len(self.SAVED_INSTANCES))
                self.assertIsNone(data['previous']) # paging per submission
                self.assertIsNone(data['next'])
                self.assertIsNone(data['previous_page'])
                self.assertIsNone(data['next_page'])
                self.assertEquals(len(data['results']), len(self.SAVED_INSTANCES))
                for index, submission in enumerate(data['results']):
                    self.assertEqual(submission['index'], index)
                    self.assertIsNotNone(submission['instance_uuid'])
                    self.assertIsNotNone(submission['date_created'])
                    self.assertIsNotNone(submission['date_modified'])
                    attachments = submission['attachments']
                    self.assertEqual(attachments['count'], 2)  # 2 attachments linked to each instance
                    self.assertEqual(len(attachments['results']), 2)


    def test_list_view_group_by_question(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                group_by = 'question'
                url = '/assets/%s/attachmments?group_by=%s' % (self.asset.uid, group_by)
                request = self.factory.get(url)
                request.user = self.user
                response = self.list_view(request, parent_lookup_asset=self.asset.uid)
                self.assertEqual(response.status_code, 200)
                data = response.data
                self.assertEquals(data['count'], len(self.questions))
                self.assertEquals(len(data['results']), len(self.questions))
                for index, question in enumerate(data['results']):
                    self.assertEqual(question['index'], index)
                    self.assertIsNotNone(question['number'])
                    self.assertIsNotNone(question['name'])
                    attachments = question['attachments']
                    self.assertEqual(attachments['count'], 2)  # 2 attachments linked to each question
                    self.assertIsNone(attachments['previous'])  # paging per attachments per question
                    self.assertIsNone(attachments['next'])
                    self.assertIsNone(attachments['previous_page'])
                    self.assertIsNone(attachments['next_page'])
                    self.assertEqual(len(attachments['results']), 2)

    @patch('kpi.serializers.image_url', MagicMock(side_effect=lambda att, size: att.media_file.url))
    def test_retrieve_view_raw_image(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                expected = self.SAVED_ATTACHMENTS[-1]
                pk = expected.pk
                filename = expected.media_file.name
                url = '/assets/%s/attachmments/%s?filename=%s' % (self.asset.uid, pk, filename)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.url, expected.media_file.url)


    @patch('kpi.serializers.image_url', MagicMock(side_effect=lambda att, size: att.media_file.url))
    def test_retrieve_view_resized_raw_image(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                expected = self.SAVED_ATTACHMENTS[-1]
                pk = expected.pk
                filename = expected.media_file.name
                size = 'small'
                url = '/assets/%s/attachmments/%s?filename=%s&size=%s' % (self.asset.uid, pk, filename, size)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.url, expected.media_file.url) # True since we're mocking image_url :)


    def test_retrieve_view_raw_image_does_not_exist(self):
        with patch('kpi.deployment_backends.kc_reader.shadow_models._models.Attachment.objects', self.qs):
            with patch('kpi.models.Asset.objects', self.parent_qs):
                expected = self.SAVED_ATTACHMENTS[-1]
                pk = expected.pk
                filename = '/path/to/bad/image.jpg'
                url = '/assets/%s/attachmments/%s?filename=%s' % (self.asset.uid, pk, filename)
                request = self.factory.get(url)
                request.user = self.user
                response = self.retrieve_view(request, parent_lookup_asset=self.asset.uid, pk=pk)

                self.assertEqual(response.status_code, 404)