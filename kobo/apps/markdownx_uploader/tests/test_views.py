import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import Resolver404, resolve, reverse

from kobo.apps.markdownx_uploader.models import MarkdownxUploaderFile
from kpi.tests.kpi_test_case import BaseTestCase

User = get_user_model()


class MarkdownxUploaderViewsTestCase(BaseTestCase):

    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username='superuser', password='superuser', email='su@example.com'
        )
        self.user = User.objects.create_user(
            username='someuser', password='someuser', email='some@example.com'
        )
        self.upload_url = reverse('markdownx-uploader-image-upload')
        self.markdownify_url = reverse('markdownx_markdownify')

    def test_anonymous_cannot_upload(self):
        response = self._upload()
        assert response.status_code == 302
        assert not MarkdownxUploaderFile.objects.exists()

    def test_regular_user_cannot_upload(self):
        self.client.force_login(self.user)
        response = self._upload()
        assert response.status_code == 302
        assert not MarkdownxUploaderFile.objects.exists()

    def test_superuser_can_upload(self):
        self.client.force_login(self.superuser)
        response = self._upload()
        assert response.status_code == 200
        assert response.json()['image_code'].startswith('![](/markdownx-uploader/file/')
        assert MarkdownxUploaderFile.objects.count() == 1

    def test_superuser_cannot_upload_svg(self):
        self.client.force_login(self.superuser)
        response = self._upload(
            name='x.svg',
            content=b'<svg xmlns="http://www.w3.org/2000/svg"/>',
            content_type='image/svg+xml',
        )
        assert response.status_code == 400
        assert not MarkdownxUploaderFile.objects.exists()

    def test_markdownify_requires_superuser(self):
        response = self.client.post(self.markdownify_url, {'content': '**x**'})
        assert response.status_code == 302

        self.client.force_login(self.user)
        response = self.client.post(self.markdownify_url, {'content': '**x**'})
        assert response.status_code == 302

        self.client.force_login(self.superuser)
        response = self.client.post(self.markdownify_url, {'content': '**x**'})
        assert response.status_code == 200
        assert response.content.decode().strip() == '<p><strong>x</strong></p>'

    def test_stock_upload_endpoint_is_not_mounted(self):
        with pytest.raises(Resolver404):
            resolve('/markdownx/upload/')

    def _upload(self, name='x.png', content=b'x', content_type='image/png'):
        return self.client.post(
            self.upload_url,
            {'image': SimpleUploadedFile(name, content, content_type=content_type)},
            headers={'x-requested-with': 'XMLHttpRequest'},
        )
