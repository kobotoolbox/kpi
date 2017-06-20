# coding: utf-8

import os
from django.conf import settings
from django.test import TestCase
from mock import patch, MagicMock
from django.core.files import File
from django.core.files.storage import Storage
from kpi.deployment_backends.kc_access.shadow_models import _models
from kpi.utils import image_tools


class ImageToolsTestCase(TestCase):
    DEFAULT_STORAGE = []
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
        storage_mock.exists.side_effect = lambda arg: arg in self.DEFAULT_STORAGE
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

        attachment = MagicMock(spec=_models.Attachment, name='AttachmentMock', absolutespec=True)
        attachment.media_file = media_file
        attachment.mimetype = mimetype

        return attachment


    def setUp(self):
        self.filename = '/path/to/my/test/image.jpg'
        self.storage_mock = self._mock_storage()
        self.DEFAULT_STORAGE = [ self.filename ]


    @patch('kpi.utils.image_tools.get_storage_class')
    def test_original_image(self, mock_get_storage_class):
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)
        attachment = self._mock_attachment(self.filename)

        result = image_tools.image_url(attachment, 'original')
        self.assertEqual(result, self.MEDIA_URL.rstrip('/') + self.filename)


    @patch('kpi.utils.image_tools.get_storage_class')
    def test_original_image_does_not_exist(self, mock_get_storage_class):
        self.DEFAULT_STORAGE = []
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)
        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)

        if settings.DEFAULT_DEPLOYMENT_BACKEND !='mock':
            expected = settings.KOBOCAT_URL.strip("/") + "/attachment/%s?media_file=%s" % ('original', filename)
            result = image_tools.image_url(attachment, 'original')
            self.assertEqual(result, expected)


    @patch('kpi.utils.image_tools.resize')
    @patch('kpi.utils.image_tools.resize_local_env')
    @patch('kpi.utils.image_tools.get_storage_class')
    def test_image_resizing(self, mock_get_storage_class, mock_resize_local_env, mock_resize):
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)

        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)
        for size in settings.THUMB_ORDER:
            suffix = settings.THUMB_CONF[size]['suffix']
            mock_resize.reset_mock()
            mock_resize.side_effect = \
                lambda arg: self.DEFAULT_STORAGE.append(image_tools.get_path(arg, suffix))
            mock_resize_local_env.reset_mock()
            mock_resize_local_env.side_effect = \
                lambda arg: self.DEFAULT_STORAGE.append(image_tools.get_path(arg, suffix))

            expected = image_tools.get_path(filename, suffix)
            result = image_tools.image_url(attachment, size)
            self.assertEqual(result, self.MEDIA_URL.rstrip('/') + expected)
            mock_resize_local_env.assert_called_once_with(filename)
            mock_resize.assert_not_called()


    @patch('kpi.utils.image_tools.resize')
    @patch('kpi.utils.image_tools.resize_local_env')
    @patch('kpi.utils.image_tools.get_storage_class')
    def test_image_resizing_fails(self, mock_get_storage_class, mock_resize_local_env, mock_resize):
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)

        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)
        for size in settings.THUMB_ORDER:
            mock_resize.reset_mock()
            mock_resize_local_env.reset_mock()

            result = image_tools.image_url(attachment, size)
            self.assertIsNone(result)
            mock_resize_local_env.assert_called_with(filename)
            mock_resize.assert_not_called()


    @patch('kpi.utils.image_tools.get_storage_class')
    def test_image_resizing_original_does_not_exist(self, mock_get_storage_class):
        self.DEFAULT_STORAGE = []
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)

        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)
        if settings.DEFAULT_DEPLOYMENT_BACKEND !='mock':
            for size in settings.THUMB_ORDER:
                expected = settings.KOBOCAT_URL.strip("/") + "/attachment/%s?media_file=%s" % (size, filename)
                result = image_tools.image_url(attachment, size)
                self.assertEqual(result, expected)


    @patch('kpi.utils.image_tools.get_storage_class')
    def test_unknown_image_size(self, mock_get_storage_class):
        mock_get_storage_class.return_value = MagicMock(return_value=self.storage_mock)
        filename = '/path/to/my/test/image.jpg'
        attachment = self._mock_attachment(filename)

        result = image_tools.image_url(attachment, 'unknown')
        self.assertEqual(result, attachment.media_file.url)
