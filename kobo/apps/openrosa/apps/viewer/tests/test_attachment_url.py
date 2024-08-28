# coding: utf-8
from django.urls import reverse
from django_digest.test import Client as DigestClient

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.libs.utils.storage import rmdir


class TestAttachmentUrl(TestBase):

    def setUp(self):
        self.attachment_count = 0
        TestBase.setUp(self)
        self._create_user_and_login()
        self._publish_transportation_form()
        self._submit_transport_instance_w_attachment()
        self.url = reverse(
            'attachment_url', kwargs={'size': 'original'})

    def test_attachment_url(self):
        self.assertEqual(
            Attachment.objects.count(), self.attachment_count + 1)
        response = self.client.get(
            self.url, {"media_file": self.attachment_media_file})
        self.assertEqual(response.status_code, 200)  # nginx is used as proxy

    def test_attachment_url_with_digest_auth(self):
        self.client.logout()
        response = self.client.get(
            self.url, {'media_file': self.attachment_media_file}
        )
        self.assertEqual(response.status_code, 401)  # nginx is used as proxy
        self.assertTrue('WWW-Authenticate' in response)
        digest_client = DigestClient()
        digest_client.set_authorization(self.login_username, self.login_password)
        response = digest_client.get(self.url, {'media_file': self.attachment_media_file})
        self.assertEqual(response.status_code, 200)

    def test_attachment_not_found(self):
        response = self.client.get(
            self.url, {"media_file": "non_existent_attachment.jpg"})
        self.assertEqual(response.status_code, 404)

    def test_attachment_has_mimetype(self):
        attachment = Attachment.objects.all().reverse()[0]
        self.assertEqual(attachment.mimetype, 'image/jpeg')

    def tearDown(self):
        if self.user and self.user.username:
            rmdir(self.user.username)
