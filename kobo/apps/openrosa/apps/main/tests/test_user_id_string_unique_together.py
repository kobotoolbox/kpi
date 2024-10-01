# coding: utf-8
import os

from kobo.apps.openrosa.apps.logger.models import XForm
from .test_base import TestBase


class TestUserIdStringUniqueTogether(TestBase):

    def test_unique_together(self):
        """
        Multiple users can have the same survey, but id_strings of
        surveys must be unique for a single user.
        """
        self._create_user_and_login()
        self.this_directory = os.path.dirname(__file__)
        xls_path = os.path.join(self.this_directory,
                                "fixtures", "gps", "gps.xls")

        # first time
        response = self._publish_xls_file(xls_path)
        self.assertEqual(XForm.objects.count(), 1)

        # second time
        response = self._publish_xls_file(xls_path)
        # SQLite returns `UNIQUE constraint failed` whereas PostgreSQL
        # returns 'duplicate key ... violates unique constraint'
        self.assertIn(
            'unique constraint',
            response.json()['text'].lower(),
        )
        self.assertEqual(XForm.objects.count(), 1)
        self.client.logout()

        # first time
        self._create_user_and_login(username="carl", password="carl")
        response = self._publish_xls_file(xls_path)
        self.assertEqual(XForm.objects.count(), 2)
