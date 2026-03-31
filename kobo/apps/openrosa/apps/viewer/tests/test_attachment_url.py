# coding: utf-8
from django.urls import reverse
from django_digest.test import Client as DigestClient

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.libs.utils.storage import rmdir


class TestBriefcaseAttachmentUrl(TestBase):

    def setUp(self):
        self.attachment_count = 0
        TestBase.setUp(self)
        self._create_user_and_login()
        self._publish_transportation_form()
        self._submit_transport_instance_w_attachment()
        self.attachment = Attachment.objects.last()

    def _url(self):
        return reverse(
            'briefcase-attachment',
            kwargs={'att_uid': self.attachment.uid},
        )

    def test_attachment_url(self):
        assert Attachment.objects.count() == self.attachment_count + 1
        response = self.client.get(self._url())
        assert response.status_code == 200

    def test_attachment_url_with_digest_auth(self):
        self.client.logout()
        response = self.client.get(self._url())
        assert response.status_code == 401
        assert 'WWW-Authenticate' in response
        digest_client = DigestClient()
        digest_client.set_authorization(self.login_username, self.login_password)
        response = digest_client.get(self._url())
        assert response.status_code == 200

    def test_attachment_not_found(self):
        url = reverse(
            'briefcase-attachment',
            kwargs={'att_uid': 'att000000000000000000000000'},
        )
        response = self.client.get(url)
        assert response.status_code == 404

    def tearDown(self):
        if self.user and self.user.username:
            rmdir(self.user.username)
