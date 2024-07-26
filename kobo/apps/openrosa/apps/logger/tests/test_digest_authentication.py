# coding: utf-8
import os

from django_digest.test import DigestAuth

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.main.models import UserProfile


class TestDigestAuthentication(TestBase):
    def setUp(self):
        super(TestBase, self).setUp()
        self._create_user_and_login()
        self._publish_transportation_form()

    def test_authenticated_submissions(self):
        """
        xml_submission_file is the field name for the posted xml file.
        """
        s = self.surveys[0]
        xml_submission_file_path = os.path.join(
            self.this_directory, 'fixtures',
            'transportation', 'instances', s, s + '.xml'
        )
        auth = DigestAuth(self.login_username, self.login_password)
        self._make_submission(xml_submission_file_path, add_uuid=True,
                              auth=auth)
        self.assertEqual(self.response.status_code, 201)

    def test_fail_authenticated_submissions_to_wrong_account(self):
        username = 'dennis'
        self._create_user_and_login(username=username, password=username)
        s = self.surveys[0]
        xml_submission_file_path = os.path.join(
            self.this_directory, 'fixtures',
            'transportation', 'instances', s, s + '.xml'
        )
        self._make_submission(
            xml_submission_file_path,
            add_uuid=True,
            auth=DigestAuth('alice', 'alice'),
            assert_success=False,
        )
        # Authentication required
        self.assertEqual(self.response.status_code, 401)

        auth = DigestAuth('dennis', 'dennis')
        self._make_submission(
            xml_submission_file_path,
            add_uuid=True,
            auth=auth,
            assert_success=False,
        )
        # Not allowed
        self.assertEqual(self.response.status_code, 403)
