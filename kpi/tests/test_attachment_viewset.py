# coding: utf-8

import os
import json
import datetime

from unittest import skip
from django.test import TestCase, RequestFactory
from django.conf import settings
from django.db.models import FileField
from django.contrib.auth.models import User
from mock import patch, MagicMock
from kpi.models import Asset
from kpi.utils import image_tools
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
        now = datetime.datetime.now().strftime('%s')
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
        self.asset = Asset.objects.get(pk=1)

        # Generate one XForm
        self._generateXForm(self.asset.uid, user=self.user, questions=self.questions)

        # Generate two Instances
        self._generateInstance(
            '498ff009-5c59-4bfa-b266-c67597f759ef',
            self.SAVED_XFORMS[0],
            answers=self.answers
        )
        self._generateInstance(
            '30f96573-0030-41a4-8e43-c5e1d8635391',
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

    def setUp(self):
        self._setUpData()
        self.factory = RequestFactory()
        self.retrieve_view = AttachmentViewSet.as_view({
            'get': 'retrieve'
        })
        self.list_view = AttachmentViewSet.as_view({
            'get': 'list'
        })