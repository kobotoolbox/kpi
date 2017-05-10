# coding: utf-8

import os
from django.conf import settings
from django.test import TestCase
from mock import patch, Mock, MagicMock
from django.core.files import File
from django.core.files.storage import Storage
from kpi.deployment_backends.kc_reader.shadow_models import _models
from kpi.utils import image_tools


class ImageToolsTestCase(TestCase):
    MEDIA_ROOT = settings.MEDIA_ROOT
    MEDIA_URL = 'http://localhost:8000' + settings.MEDIA_URL

    def _get_suffix(self, filename):
        suffix = None
        try:
            suffix = os.path.splitext(filename)[0].split('-')[-1]
        except:
            pass
        return suffix if suffix else 'original'

    def _get_size(self, filename):
        suffix = self._get_suffix(filename)
        if suffix in settings.THUMB_CONF:
            return settings.THUMB_CONF[suffix]['size']
        return 900

    def _mock_storage(self):
        storage_mock = MagicMock(spec=Storage, name='StorageMock', absolutespec=True)
        storage_mock.save = MagicMock(name='save')
        storage_mock.exists.return_value = True
        storage_mock.path.side_effect = lambda arg: self.MEDIA_ROOT.rstrip('/') + arg
        storage_mock.url.side_effect = lambda arg: self.MEDIA_URL.rstrip('/') + arg
        storage_mock.size.side_effect = lambda arg: self._get_size(arg)
        return storage_mock

    def _mock_attachment(self, filename='testfile.jpg', mimetype='image/jpeg'):
        media_file = MagicMock(spec=File, name='FileMock', absolutespec=True)
        media_file.name = filename
        media_file.path = self.MEDIA_ROOT.rstrip('/') + filename
        media_file.url = self.MEDIA_URL.rstrip('/') + filename
        media_file.size = self._get_size(filename)

        attachment = MagicMock(spec=File, name='AttachmentMock', absolutespec=True)
        attachment.media_file = media_file
        attachment.mimetype = mimetype

        return attachment

    def setUp(self):
        self.storage_mock = self._mock_storage()

    @patch('kpi.utils.image_tools.get_storage_class')
    @patch('kpi.utils.image_tools.resize', MagicMock(name='resize'))
    @patch('kpi.utils.image_tools.resize_local_env', MagicMock(name='resize_local_env'))
    def test_original_image(self, mock_get_storage_class):
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)
        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)

        url = image_tools.image_url(attachment, 'original')
        self.assertEqual(url, self.MEDIA_URL.rstrip('/') + filename)