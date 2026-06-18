import uuid
from datetime import timedelta

import pytest
from ddt import data, ddt, unpack
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from django.utils.timezone import now
from freezegun import freeze_time
from rest_framework import status

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_active_users, get_inactive_users
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix, \
    add_uuid_prefix
from kobo.apps.openrosa.libs.utils.logger_tools import dict2xform
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.constants import PERM_ADD_SUBMISSIONS
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user
from kpi.utils.xml import fromstring_preserve_root_xmlns, xml_tostring


@ddt
class UserActivityQueryTests(BaseTestCase):
    URL_NAMESPACE = ROUTER_URL_NAMESPACE
    """
    Tests for identifying in/active users based on login, asset modifications,
    and submissions
    """

    @classmethod
    def setUpTestData(cls):
        cls.old_date = now() - timedelta(days=400)
        cls.recent_date = now()
        cls.null_last_login = None

    def _create_user(self, username, last_login, date_joined=None):
        """
        Helper function to create a user
        """
        date_joined = date_joined or last_login or self.recent_date
        return User.objects.create(
            username=username, last_login=last_login, date_joined=date_joined
        )

    def _create_asset(self, user, created_at=None, modified_at=None):
        """
        Helper function to create an Asset for a given user
        """
        content_source_asset = {
            'survey': [
                {
                    'type': 'audio',
                    'label': 'q1',
                    'required': 'false',
                    '$kuid': 'abcd',
                }
            ]
        }
        asset = Asset.objects.create(
            content=content_source_asset, owner=user, asset_type='survey'
        )
        created = created_at or timezone.now()
        modified = modified_at or timezone.now()
        asset.deploy(backend='mock', active=True)
        Asset.objects.filter(id=asset.id).update(
            date_created=created, date_modified=modified
        )
        return asset

    def _update_asset(self, asset, data, user):
        """
        Helper function to update an Asset
        """
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid_asset': asset.uid}
        )
        self.client.force_login(user)
        response = self.client.patch(asset_detail_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def _post_submission(self, user, asset, submission_dict):
        """
        POST a raw submission dict to the OpenRosa endpoint as the given user.

        Builds a valid OpenRosa XML document and POSTs it to the authenticated
        submission endpoint so the full middleware stack runs and
        ExtraUserDetail.update_last_project_activity() is called naturally.
        """
        xml = fromstring_preserve_root_xmlns(
            dict2xform(submission_dict, asset.deployment.xform.id_string)
        )
        xml.tag = asset.uid
        xml.attrib = {'id': asset.uid, 'version': asset.latest_version.uid}
        data = {
            'xml_submission_file': SimpleUploadedFile(
                'submission.xml', xml_tostring(xml).encode()
            )
        }
        self.client.force_authenticate(user=user)
        self.client.force_login(user)
        response = self.client.post(reverse('submissions'), data=data)
        return response

    def _create_submission(self, user, asset, submitted_at):
        """
        Helper function to create a submission (Instance) for a given Asset.
        """
        uuid_ = str(uuid.uuid4())
        submission_dict = {
            'q1': 'answer',
            'meta': {'instanceID': add_uuid_prefix(uuid_)},
            'formhub': {'uuid': asset.deployment.xform.uuid},
        }
        with freeze_time(submitted_at):
            self._post_submission(user, asset, submission_dict)
        return Instance.objects.get(root_uuid=remove_uuid_prefix(uuid_))

    @data(
        ('user_old_login', 'old_date', 'old_date', True, False),
        ('user_recent_login', 'recent_date', 'recent_date', False, True),
        ('user_no_login', 'recent_date', 'null_last_login', False, True),
        ('user_no_login', 'old_date', 'null_last_login', True, False),
        ('AnonymousUser', 'old_date', 'old_date', False, False),
    )
    @unpack
    def test_users_based_on_login(
        self, username, last_login, date_joined, expected_inactive, expected_active
    ):
        """
        Test users with last login older/newer than 1 year, and no login
        """
        if username == 'AnonymousUser':
            user = get_anonymous_user()
        else:
            user = self._create_user(
                username,
                getattr(self, last_login),
                date_joined=getattr(self, date_joined),
            )
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertEqual(expected_inactive, user in inactive_users)
        self.assertEqual(expected_active, user in active_users)

    def test_users_based_on_form_activity(self):
        """
        Test that a user initially marked as inactive due to old assets and
        submissions becomes active after updating an asset
        """
        user = self._create_user('active_asset', self.old_date)
        asset = self._create_asset(user, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Update the asset and ensure the user is no longer inactive
        self._update_asset(asset, {'name': 'Updated asset'}, user)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_user_becomes_active_after_submission_update(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after updating a submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        instance = self._create_submission(user, asset, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Update the submission and ensure the user is no longer inactive
        self._post_submission(user, asset, {
            'q1': 'new_answer',
            'meta': {
                'instanceID': f'uuid:{uuid.uuid4()}',
                'deprecatedID': f'uuid:{instance.uuid}',
            },
            'formhub': {'uuid': asset.deployment.xform.uuid},
        })
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_user_becomes_active_after_new_submission(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after making a new submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(user, asset, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Create a new submission and ensure the user is no longer inactive
        self._create_submission(user, asset, self.recent_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_owner_becomes_active_after_collaborator_edits_submission(self):
        """
        Test that editing a submission (by any user with change_submissions)
        marks the form owner as active via ExtraUserDetail.last_project_activity.
        """
        owner = self._create_user('owner', self.old_date)
        collaborator = User.objects.create_user(username='collaborator')

        asset = self._create_asset(owner, self.old_date, self.old_date)
        asset.assign_perm(collaborator, 'change_submissions')
        instance = self._create_submission(owner, asset, self.old_date)

        inactive_users = get_inactive_users()
        active_users = get_active_users()
        assert owner in inactive_users
        assert owner not in active_users

        # Collaborator edits the submission
        response = self._post_submission(collaborator, asset, {
            'q1': 'corrected_answer',
            'meta': {
                'instanceID': f'uuid:{uuid.uuid4()}',
                'deprecatedID': f'uuid:{instance.uuid}',
            },
            'formhub': {'uuid': asset.deployment.xform.uuid},
        })
        assert response.status_code in (201, 202), f'Edit failed: {response.status_code} {response.data}'

        inactive_users = get_inactive_users()
        active_users = get_active_users()
        assert owner not in inactive_users
        assert owner in active_users

    def test_user_becomes_active_after_submitting_to_another_users_form(self):
        """
        Test that both the submitter and the form owner are marked active when
        a submission is added to another user's form, even if the submitter
        doesn't own any assets.
        """
        asset_owner = self._create_user('asset_owner', self.old_date)
        asset = self._create_asset(asset_owner, self.old_date, self.old_date)

        # Create submitter with old login and no assets of their own
        submitter = self._create_user('submitter', self.old_date)
        asset.assign_perm(submitter, PERM_ADD_SUBMISSIONS)

        # Initially both should be inactive
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        assert submitter in inactive_users
        assert submitter not in active_users
        assert asset_owner in inactive_users
        assert asset_owner not in active_users

        # Create a submission to the asset owner's form
        self._create_submission(submitter, asset, self.recent_date)

        # Now both submitter and form owner should be active
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        assert submitter not in inactive_users
        assert submitter in active_users
        assert asset_owner not in inactive_users
        assert asset_owner in active_users

    def test_last_project_activity_set_when_collaborator_modifies_asset(self):
        """
        Verify that modifying another user's asset sets last_project_activity
        for both the collaborator and the asset owner.
        """
        owner = self._create_user('lpa_asset_owner', self.old_date)
        collaborator = User.objects.create_user(username='lpa_asset_collab')
        asset = self._create_asset(owner, self.old_date, self.old_date)
        asset.assign_perm(collaborator, 'change_asset')

        assert owner.extra_details.last_project_activity is None
        assert collaborator.extra_details.last_project_activity is None

        self._update_asset(asset, {'name': 'Collaborator rename'}, collaborator)

        owner.extra_details.refresh_from_db()
        collaborator.extra_details.refresh_from_db()
        assert owner.extra_details.last_project_activity is not None
        assert collaborator.extra_details.last_project_activity is not None

    def test_last_project_activity_set_on_asset_creation(self):
        """
        Verify that creating a new asset via the API sets last_project_activity
        for the owner.
        """
        user = self._create_user('lpa_asset_creator', self.old_date)
        assert user.extra_details.last_project_activity is None

        asset_list_url = reverse(self._get_endpoint('asset-list'))
        self.client.force_login(user)
        response = self.client.post(
            asset_list_url,
            data={'asset_type': 'survey', 'name': 'New project'},
        )
        assert response.status_code == status.HTTP_201_CREATED

        user.extra_details.refresh_from_db()
        assert user.extra_details.last_project_activity is not None

    def test_users_in_trash_excluded_from_inactive_user_query(self):
        user = self._create_user('active_submission', self.old_date)
        superuser = User.objects.create_superuser('super')

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(user, asset, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)
        move_to_trash(
            request_author=superuser,
            objects_list=[{'pk': user.pk, 'username': user.username}],
            grace_period=1,
            trash_type='user',
        )
        inactive_users = get_inactive_users()
        self.assertFalse(user in inactive_users)
