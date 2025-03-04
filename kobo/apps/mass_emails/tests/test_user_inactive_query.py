import json
import os
from datetime import timedelta

from ddt import data, ddt, unpack
from django.test import TestCase
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_inactive_users
from kobo.apps.openrosa.apps.logger.models import XForm, Instance


@ddt
class InactiveUserTest(TestCase):
    """
    Tests for identifying inactive users based on login, xform modifications,
    and submissions
    """
    @classmethod
    def setUpTestData(cls):
        cls.old_date = now() - timedelta(days=400)
        cls.recent_date = now()

        # Load XML and JSON for xform creation
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'water_translated_form.xml'
            )
        ) as f:
            cls.test_form_xml = f.read()

        cls.test_form_json = json.dumps({
            'default_language': 'default',
            'id_string': 'Water_2011_03_17',
            'children': [],
            'name': 'Water_2011_03_17',
            'title': 'Water_2011_03_17',
            'type': 'survey'
        })

    def _create_user(self, username, last_login):
        """
        Helper function to create a user
        """
        return User.objects.create(username=username, last_login=last_login)

    def _create_xform(self, user, created_at, modified_at):
        """
        Helper function to create an XForm for a given user
        """
        xform = XForm.objects.create(
            xml=self.test_form_xml, user=user, json=self.test_form_json
        )
        xform.date_created = created_at
        xform.date_modified = modified_at
        xform.save(update_fields=['date_created', 'date_modified'])
        return xform

    def _create_submission(self, user, xform, created_at, modified_at):
        """
        Helper function to create a submission (Instance) for a given XForm
        """
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'water_translated_submission.xml'
            )
        ) as f:
            xml = f.read()

        submission = Instance.objects.create(xml=xml, user=user, xform=xform)
        submission.date_created = created_at
        submission.date_modified = modified_at
        submission.save(update_fields=['date_created', 'date_modified'])
        return submission

    @data(
        ('user_old_login', 'old_date', True),
        ('user_recent_login', 'recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_login(self, username, last_login, expected):
        """
        Test users with last login older/newer than 1 year
        """
        user = self._create_user(username, getattr(self, last_login))
        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)

    @data(
        ('old_date', True),
        ('recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_form_activity(self, date, expected):
        """
        Test users with inactive/active XForm modification dates
        """
        user = self._create_user('active_xform', self.old_date)
        self._create_xform(user, getattr(self, date), getattr(self, date))

        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)

    @data(
        ('old_date', True),
        ('recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_submission_activity(self, date, expected):
        """
        Test users with inactive/active submission dates
        """
        user = self._create_user('active_submission', self.old_date)
        xform = self._create_xform(user, self.old_date, self.old_date)
        self._create_submission(
            user, xform, getattr(self, date), getattr(self, date)
        )

        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)
