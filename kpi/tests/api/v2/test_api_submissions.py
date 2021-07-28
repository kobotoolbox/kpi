# coding: utf-8
import json
import random
import string
import time
import uuid
from datetime import datetime

import pytz
from django.conf import settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class BaseSubmissionTestCase(BaseTestCase):
    """
    DataViewset uses `BrowsableAPIRenderer` as the first renderer.
    Force JSON to test the API by specifying `format` (GET requests)
    or `HTTP_ACCEPT` (other requests)
    """

    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        self.someuser = User.objects.get(username="someuser")
        self.anotheruser = User.objects.get(username="anotheruser")
        content_source_asset = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(content=content_source_asset.content,
                                          owner=self.someuser,
                                          asset_type='survey')

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.__add_submissions()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = self.asset.deployment.submission_list_url
        self._deployment = self.asset.deployment

    def get_random_submission(self, user: 'auth.User') -> dict:
        return self.get_random_submissions(user, 1)[0]

    def get_random_submissions(self, user: 'auth.User', limit: int = 1) -> list:
        """
        Get random submissions within all generated submissions.
        If user is the owner, we only return submissions submitted by unknown.
        It is useful to ensure restricted users fail tests with forbidden
        submissions.
        """
        query = {}
        if self.asset.owner == user:
            query = {'_submitted_by': ''}

        submissions = self.asset.deployment.get_submissions(user, query=query)
        random.shuffle(submissions)
        return submissions[:limit]

    def _log_in_as_another_user(self):
        """
        Helper to switch user from `someuser` to `anotheruser`.
        """
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")

    def __add_submissions(self):
        letters = string.ascii_letters
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid
        self.submissions_submitted_by_someuser = []
        self.submissions_submitted_by_unknown = []
        self.submissions_submitted_by_anotheruser = []

        for i in range(20):
            submitted_by = random.choice(['', 'someuser', 'anotheruser'])
            submission = {
                '__version__': v_uid,
                'q1': ''.join(random.choice(letters) for l in range(10)),
                'q2': ''.join(random.choice(letters) for l in range(10)),
                'meta/instanceID': f'uuid:{uuid.uuid4()}',
                '_validation_status': {
                    'by_whom': 'someuser',
                    'timestamp': int(time.time()),
                    'uid': 'validation_status_on_hold',
                    'color': '#0000ff',
                    'label': 'On Hold'
                },
                '_submitted_by': submitted_by
            }

            if submitted_by == 'someuser':
                self.submissions_submitted_by_someuser.append(submission)

            if submitted_by == '':
                self.submissions_submitted_by_unknown.append(submission)

            if submitted_by == 'anotheruser':
                self.submissions_submitted_by_anotheruser.append(submission)

            submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions)
        self.submissions = submissions


class BulkDeleteSubmissionsApiTests(BaseSubmissionTestCase):

    # TODO, Add tests with ids and query

    def setUp(self):
        super().setUp()
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )
        self.submission_bulk_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
            },
        )

    def test_delete_submissions_as_owner(self):
        """
        someuser is the project owner
        someuser can delete their own data
        """
        data = {'payload': {'confirm': True}}
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})

        self.assertEqual(response.data['count'], 0)

    def test_delete_submissions_as_anonymous(self):
        """
        someuser is the project owner.
        The project is not shared publicly.
        anonymous cannot view someuser's data, therefore cannot delete it.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        data = {'payload': {'confirm': True}}
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_not_shared_submissions_as_anotheruser(self):
        """
        someuser is the project owner.
        The project is not shared with anyone.
        anotheruser cannot view someuser's data, therefore cannot delete it.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        data = {'payload': {'confirm': True}}
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_shared_submissions_as_anotheruser(self):
        """
        someuser is the project owner.
        The project is shared with anotheruser.
        anotheruser can delete someuser's data.
        """

        self.asset.assign_perm(self.anotheruser, PERM_DELETE_SUBMISSIONS)
        self._log_in_as_another_user()
        data = {'payload': {'confirm': True}}

        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], 0)

    def test_delete_all_allowed_submissions_with_partial_perms_as_anotheruser(self):
        """
        someuser is the project owner.
        anotheruser has partial permissions and can view and delete their own
        submitted data

        Test that anotheruser can delete all their data at once and if they do,
        only delete their data.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_DELETE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to delete their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Delete only submissions submitted by anotheruser
        data = {'payload': {'confirm': True}}
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], 0)

        # Ensure anotheruser only deleted their submissions
        # Log in as the owner of the project: `someuser`. They can retrieve all
        # submissions
        self.login_as_other_user('someuser', 'someuser')
        response = self.client.get(self.submission_list_url, {'format': 'json'})

        unknown_submission_ids = [
            sub['_id'] for sub in self.submissions_submitted_by_unknown
        ]
        someuser_submission_ids = [
            sub['_id'] for sub in self.submissions_submitted_by_someuser
        ]
        submission_ids = [sub['_id'] for sub in response.data['results']]
        not_anotheruser_submission_ids = [
            int(id_) for id_ in (unknown_submission_ids + someuser_submission_ids)
        ]
        # Results should contain only data submitted by unknown and someuser
        self.assertEqual(
            sorted(not_anotheruser_submission_ids),
            sorted(submission_ids)
        )

    def test_delete_some_allowed_submissions_with_partial_perms_as_anotheruser(self):
        """
        someuser is the project owner.
        anotheruser has partial permissions and can view and delete their own
        submitted data

        Test that anotheruser can delete part of their data
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_DELETE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to delete their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        random_submissions = self.get_random_submissions(self.asset.owner, 3)
        data = {
            'payload': {
                'submission_ids': [rs['_id'] for rs in random_submissions]
            }
        }
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        count = self._deployment.calculated_submission_count(self.anotheruser)
        random_submissions = self.get_random_submissions(self.anotheruser, 3)
        data = {
            'payload': {
                'submission_ids': [rs['_id'] for rs in random_submissions],
            }
        }
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], count - len(random_submissions))

    def test_cannot_delete_view_only_submissions_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project
        anotheruser is allowed to view someuser's data and delete their own data

        Test that anotheruser cannot delete someuser's data
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'someuser'}],
            PERM_DELETE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]  # view_submission is implied
        }

        # Allow anotheruser to delete their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try to view all submissions
        viewable_submissions = (
            self.submissions_submitted_by_anotheruser
            + self.submissions_submitted_by_someuser
        )
        viewable_submission_ids = [int(sub['_id']) for sub in viewable_submissions]
        response = self.client.get(self.submission_list_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_ids = [int(sub['_id']) for sub in response.data['results']]
        self.assertEqual(sorted(response_ids), sorted(viewable_submission_ids))

        # Try to delete all viewable submissions
        data = {
            'payload': {
                'submission_ids': viewable_submission_ids
            }
        }
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try to delete someuser's data
        data = {
            'payload': {
                'submission_ids': [
                    sub['_id'] for sub in self.submissions_submitted_by_someuser
                ]
            }
        }
        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SubmissionApiTests(BaseSubmissionTestCase):

    def test_cannot_create_submission(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anotheruser has view access on someuser's data

        Test that no one can create submissions (with KPI endpoint)
        """
        submission = {
            "q1": "a5",
            "q2": "a6",
        }
        # Owner
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Shared
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Anonymous
        self.client.logout()
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_as_owner(self):
        """
        someuser is the owner of the project.
        They can list their own data
        """
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('results'), self.submissions)
        self.assertEqual(response.data.get('count'), len(self.submissions))

    def test_list_submissions_as_owner_with_params(self):
        """
        someuser is the owner of the project.
        They can list their own data and they can narrow down the results with
        params
        """
        response = self.client.get(
            self.submission_list_url, {
                'format': 'json',
                'start': 1,
                'limit': 5,
                'sort': '{"q1": -1}',
                'fields': '["q1", "_submitted_by"]',
                'query': '{"_submitted_by": {"$in": ["", "someuser", "another"]}}',
            }
        )
        # ToDo add more assertions. E.g. test whether sort, limit, start really work
        self.assertEqual(len(response.data['results']), 5)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_submissions_limit(self):
        """
        someuser is the owner of the project.
        Test that hard-coded maximum limit cannot be exceeded by user's requests.
        """
        limit = settings.SUBMISSION_LIST_LIMIT
        excess = 10
        asset = Asset.objects.create(
            name='Lots of submissions',
            owner=self.asset.owner,
            content={'survey': [{'name': 'q', 'type': 'integer'}]},
        )
        asset.deploy(backend='mock', active=True)
        asset.deployment.set_namespace(self.URL_NAMESPACE)
        latest_version_uid = asset.latest_deployed_version.uid
        submissions = [
            {
                '__version__': latest_version_uid,
                'q': i,
            } for i in range(limit + excess)
        ]
        asset.deployment.mock_submissions(submissions)

        # Server-wide limit should apply if no limit specified
        response = self.client.get(
            asset.deployment.submission_list_url, {'format': 'json'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), limit)
        # Limit specified in query parameters should not be able to exceed
        # server-wide limit
        response = self.client.get(
            asset.deployment.submission_list_url,
            {'limit': limit + excess, 'format': 'json'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), limit)

    def test_list_submissions_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser cannot view someuser's data.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access on someuser's data. They can view all
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('results'), self.submissions)
        self.assertEqual(response.data.get('count'), len(self.submissions))

    def test_list_submissions_with_partial_permissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view access on someuser's project.
        They can view only the data they submitted to someuser's project.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # User `anotheruser` should only see submissions where `submitted_by`
        # is filled in and equals to `anotheruser`
        viewable_submissions_count = len(self.submissions_submitted_by_anotheruser)
        self.assertTrue(response.data.get('count') == viewable_submissions_count)
        for submission in response.data['results']:
            self.assertTrue(submission['_submitted_by'] == 'anotheruser')

    def test_list_submissions_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anonymous cannot view someuser's data.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_asset_publicly_shared_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is shared publicly.
        anonymous can view someuser's data
        """
        self.client.logout()
        anonymous_user = get_anonymous_user()
        self.asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_submissions_asset_publicly_shared_as_authenticated_user(self):
        """
        someuser is the owner of the project.
        The project is shared publicly.
        anotheruser has view access on someuser's project.
        Test if anotheruser can see someuser's data

        See https://github.com/kobotoolbox/kpi/issues/2698
        """

        anonymous_user = get_anonymous_user()
        self._log_in_as_another_user()

        # Give the user who will access the public data--without any explicit
        # permission assignment--their own asset. This is needed to expose a
        # flaw in `ObjectPermissionMixin.__get_object_permissions()`
        Asset.objects.create(name='i own it', owner=self.anotheruser)

        # `self.asset` is owned by `someuser`; `anotheruser` has no
        # explicitly-granted access to it
        self.asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.asset.remove_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)

    def test_list_submissions_asset_publicly_shared_and_shared_with_user_as_anotheruser(self):
        """
        Running through behaviour described in issue kpi/#2870 where an asset
        that has been publicly shared and then explicity shared with a user, the
        user has lower permissions than an anonymous and is therefore
        unable to view submission data.
        """

        self._log_in_as_another_user()
        anonymous_user = get_anonymous_user()

        assert not self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET)
        assert PERM_VIEW_ASSET not in self.asset.get_perms(self.anotheruser)
        assert not self.asset.has_perm(self.anotheruser, PERM_CHANGE_ASSET)
        assert PERM_CHANGE_ASSET not in self.asset.get_perms(self.anotheruser)

        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_ASSET)

        assert self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET)
        assert PERM_VIEW_ASSET in self.asset.get_perms(self.anotheruser)
        assert self.asset.has_perm(self.anotheruser, PERM_CHANGE_ASSET)
        assert PERM_CHANGE_ASSET in self.asset.get_perms(self.anotheruser)

        assert not self.asset.has_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        assert PERM_VIEW_SUBMISSIONS not in self.asset.get_perms(
            self.anotheruser
        )

        self.asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)

        assert self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET)
        assert PERM_VIEW_ASSET in self.asset.get_perms(self.anotheruser)

        assert self.asset.has_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        assert PERM_VIEW_SUBMISSIONS in self.asset.get_perms(self.anotheruser)

        # resetting permissions of asset
        self.asset.remove_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.asset.remove_perm(self.anotheruser, PERM_CHANGE_ASSET)
        self.asset.remove_perm(anonymous_user, PERM_VIEW_ASSET)
        self.asset.remove_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)

    def test_retrieve_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can view one of their submission.
        """
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])

        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, submission)

    def test_retrieve_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has no access to someuser's data
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_submission_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access to someuser's data.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, submission)

    def test_retrieve_submission_with_partial_permissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view access to someuser's data.
        They can only see their own data.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)

        # Try first submission submitted by unknown
        submission = self.get_random_submission(self.asset.owner)
        url = self._deployment.get_submission_detail_url(submission['_id'])
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Try second submission submitted by another
        submission = self.submissions_submitted_by_anotheruser[0]
        url = self._deployment.get_submission_detail_url(submission['_id'])
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can delete their own data.
        """
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})

        self.assertEqual(response.data['count'], len(self.submissions) - 1)

    def test_delete_not_existing_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser should receive a 404 if they try to delete a non-existing
        submission.
        """
        url = self.asset.deployment.get_submission_detail_url(9999)
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anonymous cannot view someuser's data, therefore they cannot delete it
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anynone.
        anotheruser cannot view someuser's data, therefore they cannot delete it.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access to someuser's data.
        anotheruser can view someuser's data but they cannot delete it.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # `another_user` should not be able to delete with 'change_submissions'
        # permission.
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Let's assign them 'delete_submissions'. Everything should be ok then!
        self.asset.assign_perm(self.anotheruser, PERM_DELETE_SUBMISSIONS)
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], len(self.submissions) - 1)

    def test_delete_submission_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial access to someuser's data.
        anotheruser can only view/delete their data.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_DELETE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to view/delete their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknown[0]
        url = self._deployment.get_submission_detail_url(submission['_id'])
        response = self.client.delete(url,
                                      content_type='application/json',
                                      HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        anotheruser_submission_count = len(self.submissions_submitted_by_anotheruser)
        submission = self.get_random_submission(self.anotheruser)
        url = self._deployment.get_submission_detail_url(submission['_id'])
        response = self.client.delete(url,
                                      content_type='application/json',
                                      HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(
            response.data['count'], anotheruser_submission_count - 1
        )


class SubmissionEditApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self.submission = self.get_random_submission(self.asset.owner)
        self.submission_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
                'action': 'edit',
            },
        )
        self.submission_url_legacy = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

    def test_get_legacy_edit_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link through old API endpoint
        """
        response = self.client.get(self.submission_url_legacy, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

        expected_response = {
            'url': 'http://server.mock/enketo/edit/{}'.format(self.submission['_id'])
        }
        assert response.data == expected_response

    def test_get_edit_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link
        """
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

        url = f"http://server.mock/enketo/edit/{self.submission['_id']}"
        expected_response = {'url': url}
        self.assertEqual(response.data, expected_response)

    def test_get_edit_link_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anonymous cannot view the project, therefore cannot edit data.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_edit_link_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser cannot view the project, therefore cannot edit data.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_get_edit_link_submission_shared_with_view_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser can only view the project, therefore they cannot edit data.
        someuser's data existence should not be revealed.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {'format': 'json'})

        # FIXME if anotheruser has view permissions, they should receive a 403
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_edit_link_submission_shared_with_edit_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has 'change_submissions' permissions.
        anotheruser can retrieve enketo edit link
        """
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    def test_get_edit_link_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial permissions on someuser's data
        anotheruser can only view/edit their own data
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to edit their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        submission = self.get_random_submission(self.asset.owner)
        url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        submission = self.get_random_submission(self.anotheruser)
        url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        url = f"http://server.mock/enketo/edit/{submission['_id']}"
        expected_response = {'url': url}
        self.assertEqual(response.data, expected_response)


class SubmissionViewApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self.submission = self.get_random_submission(self.asset.owner)
        self.submission_view_link_url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

    def test_get_view_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can get enketo view link
        """
        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

        expected_response = {
            'url': 'http://server.mock/enketo/view/{}'.format(self.submission['_id'])
        }
        assert response.data == expected_response

    def test_get_view_link_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anonymous cannot view the project, therefore cannot retrieve enketo link.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_get_view_link_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared.
        anotheruser cannot view the project, therefore cannot retrieve enketo link.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_view_link_submission_shared_with_view_only_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has 'view_submissions' permissions.
        anotheruser can retrieve enketo view link.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    def test_get_view_link_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view permissions on someuser's data
        anotheruser can only view their own data
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to view their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknown[0]
        url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        url = f"http://server.mock/enketo/view/{submission['_id']}"
        expected_response = {'url': url}
        self.assertEqual(response.data, expected_response)


class SubmissionDuplicateApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        current_time = datetime.now(tz=pytz.UTC).isoformat('T', 'milliseconds')
        # TODO: also test a submission that's missing `start` or `end`; see
        # #3054. Right now that would be useless, though, because the
        # MockDeploymentBackend doesn't use XML at all and won't fail if an
        # expected field is missing
        for submission in self.submissions:
            submission['start'] = current_time
            submission['end'] = current_time

        self.asset.deployment.mock_submissions(self.submissions)

        self.submission = self.get_random_submission(self.asset.owner)
        self.submission_url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

    def _check_duplicate(self, response, submission: dict = None):
        """
        Given `submission`, the source submission, and `response`, as returned
        by a request to duplicate `submission`, verify that the new, duplicate
        submission has the expected attributes
        """
        submission = submission if submission else self.submission
        duplicate_submission = response.data

        expected_next_id = max((sub['_id'] for sub in self.submissions)) + 1
        assert submission['_id'] != duplicate_submission['_id']
        assert duplicate_submission['_id'] == expected_next_id
        assert submission['meta/instanceID'] != duplicate_submission['meta/instanceID']
        assert submission['start'] != duplicate_submission['start']
        assert submission['end'] != duplicate_submission['end']

    def test_duplicate_submission_as_owner_allowed(self):
        """
        someuser is the owner of the project.
        someuser is allowed to duplicate their own data
        """
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED
        self._check_duplicate(response)

    def test_duplicate_submission_as_anotheruser_not_allowed(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data and someuser's data existence
        should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_duplicate_submission_as_anonymous_not_allowed(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous has no access to someuser's data and someuser's data existence
        should not be revealed.
        """
        self.client.logout()
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_duplicate_submission_as_anotheruser_with_view_perm(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has only view submissions permission, therefore cannot
        edit/duplicate someuser's data.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_submission_as_anotheruser_with_change_perm_allowed(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has edit submissions permission. They can edit/duplicate
        someuser's data.
        """
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED
        self._check_duplicate(response)

    def test_cannot_duplicate_submission_as_anotheruser_with_view_add_perms(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has view and add submissions permissions.
        Change and Add submission permissions are needed to duplicate.
        They cannot duplicate someuser's data.
        """
        for perm in [PERM_VIEW_SUBMISSIONS, PERM_ADD_SUBMISSIONS]:
            self.asset.assign_perm(self.anotheruser, perm)
        self._log_in_as_another_user()
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_submission_as_anotheruser_with_partial_perms(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser has partial change submissions permissions.
        They can edit/duplicate their own data only.
        """
        self._log_in_as_another_user()

        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        # Allow anotheruser to duplicate someuser's data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        submission = self.get_random_submission(self.asset.owner)
        url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.post(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        submission = self.get_random_submission(self.anotheruser)
        url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.post(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self._check_duplicate(response, submission)


class BulkUpdateSubmissionsApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self.submission_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
            },
        )

        random_submissions = self.get_random_submissions(self.asset.owner, 3)
        self.updated_submission_data = {
            'submission_ids': [rs['_id'] for rs in random_submissions],
            'data': {
                'q1': '🕺',
            },
        }

        self.submitted_payload = {
            'payload': self.updated_submission_data
        }

    def _check_bulk_update(self, response):
        submission_ids = self.updated_submission_data['submission_ids']
        # Check that the number of ids given matches the number of successful
        assert len(submission_ids) == response.data['successes']

    def test_bulk_update_submissions_allowed_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can bulk update their own data.
        """
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self._check_bulk_update(response)

    def test_cannot_bulk_update_submissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser cannot access someuser's data.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_bulk_update_submissions_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous cannot access someuser's data.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_bulk_update_submissions_as_anotheruser_with_view_perm(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser
        anotheruser can only view someuser's data, therefore they cannot bulk
        update someuser's data
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_update_submissions_as_anotheruser_with_change_perm(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser
        anotheruser can edit view someuser's data
        """
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self._check_bulk_update(response)

    def test_bulk_update_submissions_as_anotheruser_with_partial_perms(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser
        anotheruser can only edit their own data.
        """
        self._log_in_as_another_user()

        # Allow anotheruser to update their own data
        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }

        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try to update all submissions, but anotheruser is allowed to update
        # their own submissions only.
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Update some of another's submissions
        random_submissions = self.get_random_submissions(self.anotheruser, 3)
        self.updated_submission_data['submission_ids'] = [
            rs['_id'] for rs in random_submissions
        ]
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self._check_bulk_update(response)


class SubmissionValidationStatusApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self.submission = self.get_random_submission(self.asset.owner)
        self.validation_status_url = (
            self._deployment.get_submission_validation_status_url(
                self.submission['_id']
            )
        )

    def test_retrieve_status_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve status of their own submissions
        """
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_cannot_retrieve_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_status_of_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has view submissions permissions on someuser's data.
        anotheruser can view validation status of submissions.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_cannot_retrieve_status_of_shared_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous has no access to someuser's data.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_status_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can delete the validation status of submissions
        """
        response = self.client.delete(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Ensure delete worked.
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_cannot_delete_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data, therefore cannot delete
        validation status.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.delete(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_status_of_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser
        anotheruser has validate submission permission.
        anotheruser can delete validation status of the project.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VALIDATE_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.delete(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Ensure delete worked.
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_cannot_delete_status_of_not_shared_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous cannot change validation statuses.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.delete(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_status_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can update validation status.
        """
        data = {
            'validation_status.uid': 'validation_status_not_approved'
        }
        response = self.client.patch(self.validation_status_url, data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Ensure update worked.
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['by_whom'], 'someuser')
        self.assertEqual(response.data['uid'], data['validation_status.uid'])

    def test_cannot_edit_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's submissions and therefore, cannot
        validate them.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        response = self.client.patch(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_status_of_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has validate submission permission.
        anotheruser can edit validation status of the project.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VALIDATE_SUBMISSIONS)
        self._log_in_as_another_user()
        data = {
            'validation_status.uid': 'validation_status_not_approved'
        }
        response = self.client.patch(self.validation_status_url, data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Ensure update worked.
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['by_whom'], 'anotheruser')
        self.assertEqual(response.data['uid'], data['validation_status.uid'])

    def test_cannot_edit_status_of_not_shared_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous has no access to someuser's submissions and therefore, cannot
        validate them.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        response = self.client.patch(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_status_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial access to someuser's data.
        anotheruser can only view and validate their data.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate someuser's data
        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        data = {
            'validation_status.uid': 'validation_status_not_approved'
        }

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknown[0]
        url = (
            self._deployment.get_submission_validation_status_url(
                submission['_id']
            )
        )
        response = self.client.patch(url, data=data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        submission = self.submissions_submitted_by_anotheruser[0]
        url = (
            self._deployment.get_submission_validation_status_url(
                submission['_id']
            )
        )
        response = self.client.patch(url, data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Ensure update worked.
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['by_whom'], 'anotheruser')
        self.assertEqual(response.data['uid'], data['validation_status.uid'])


class SubmissionValidationStatusesApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        for submission in self.submissions:
            submission['_validation_status']['uid'] = 'validation_status_not_approved'
        self.asset.deployment.mock_submissions(self.submissions)
        self.validation_statuses_url = reverse(
            self._get_endpoint('submission-validation-statuses'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )

    def test_delete_all_status_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can bulk delete the status of all their submissions.
        """
        data = {
            'payload': {
                'validation_status.uid': None,
            }
        }
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')
        # `confirm` must be sent within the payload (when all submissions are
        # modified). Otherwise, a ValidationError is raised
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        data['payload']['confirm'] = True
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(self.someuser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            self.assertEqual(submission['_validation_status'], {})

    def test_delete_some_statuses_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can bulk delete the status of some of their submissions.
        """
        submission_id = 1
        data = {
            'payload': {
                'validation_status.uid': None,
                'submission_ids': [submission_id]
            }
        }
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(
            self.someuser, submission_ids=[submission_id]
        )
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            if submission['_id'] == submission_id:
                self.assertEqual(submission['_validation_status'], {})
            else:
                self.assertNotEqual(submission['_validation_status'], {})

        # TODO Test with `query` when Mockbackend support Mongo queries

    def test_delete_status_of_not_shared_submissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's submissions and therefore, cannot
        bulk delete the validation status of them.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        data = {
            'payload': {
                'validation_status.uid': None,
                'confirm': True,
            }
        }
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_status_of_shared_submissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser can bulk delete all someuser's submission validation statues
        at once
        """

        self.asset.assign_perm(self.anotheruser, PERM_VALIDATE_SUBMISSIONS)
        self._log_in_as_another_user()
        data = {
            'payload': {
                'validation_status.uid': None,
                'confirm': True,
            }
        }
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(self.anotheruser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            self.assertEqual(submission['_validation_status'], {})

    def test_delete_all_statuses_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anonymous has no access to someuser's submissions and therefore, cannot
        bulk delete the validation status of them.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        data = {
            'payload': {
                'validation_status.uid': None,
                'confirm': True,
            }
        }
        response = self.client.delete(self.validation_statuses_url,
                                      data=data,
                                      format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_all_submission_validation_statuses_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can edit all validation statuses at once.
        `confirm=true` must be sent when the request alters all the submissions
        at once.
        """
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
            }
        }
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        # `confirm` must be sent within payload (when all submissions are
        # modified). Otherwise, a ValidationError is raised
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        data['payload']['confirm'] = True
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(self.someuser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            self.assertEqual(validation_status['by_whom'], 'someuser')
            self.assertEqual(
                validation_status['uid'], data['payload']['validation_status.uid']
            )

    def test_edit_some_submission_validation_statuses_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can edit some validation statuses at once.
        """
        submission_id = 1
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': [submission_id]
            }
        }
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(
            self.someuser, submission_ids=[submission_id]
        )
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            if submission['_id'] == submission_id:
                self.assertEqual(validation_status['by_whom'], 'someuser')
                self.assertEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )

    def test_cannot_edit_submission_validation_statuses_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's submissions and therefore, cannot
        bulk edit the validation status of them.
        someuser's data existence should not be revealed.
        """
        self._log_in_as_another_user()
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'confirm': True,
            }
        }
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_submission_validation_statuses_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is shared with anotheruser.
        anotheruser has validate submissions permissions and therefore, can
        bulk edit all the validation status of them at once.
        `confirm=true` must be sent when the request alters all the submissions
        at once.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VALIDATE_SUBMISSIONS)
        self._log_in_as_another_user()
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'confirm': True,
            }
        }
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(
            self.anotheruser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            self.assertEqual(validation_status['by_whom'], 'anotheruser')
            self.assertEqual(
                validation_status['uid'],
                data['payload']['validation_status.uid']
            )

    def test_cannot_edit_submission_validation_statuses_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's submissions and therefore, cannot
        bulk edit the validation status of them.
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'confirm': True,
            }
        }
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_all_submission_validation_statuses_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser can only validate their own data.
        `confirm=true` must be sent when the request alters all their submissions
        at once.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [
                {'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate their own data
        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'confirm': True,
            }
        }

        # Update all submissions anotheruser is allowed to edit
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count = self._deployment.calculated_submission_count(
            self.anotheruser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Get all submissions and ensure only the ones that anotheruser is
        # allowed to edit have been modified
        self.client.logout()
        self.client.login(username="someuser", password="someuser")
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            if submission['_submitted_by'] == 'anotheruser':
                self.assertEqual(validation_status['by_whom'], 'anotheruser')
                self.assertEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(validation_status['by_whom'], 'anotheruser')
                self.assertNotEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )

    def test_edit_some_submission_validation_statuses_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser can only validate their own data.
        """
        self._log_in_as_another_user()
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [
                {'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate their own data
        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)

        random_submissions = self.get_random_submissions(self.asset.owner, 3)
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': [
                    rs['_id'] for rs in random_submissions
                ]
            }
        }

        # Try first submission submitted by unknown
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try 2nd submission submitted by anotheruser
        random_submissions = self.get_random_submissions(self.anotheruser, 3)
        data['payload']['submission_ids'] = [
            rs['_id'] for rs in random_submissions
        ]
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count = self._deployment.calculated_submission_count(
            self.anotheruser, submission_ids=data['payload']['submission_ids'])
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Get all submissions and ensure only the ones that anotheruser is
        # allowed to edit have been modified
        self.client.logout()
        self.client.login(username="someuser", password="someuser")
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            if submission['_id'] in data['payload']['submission_ids']:
                self.assertEqual(validation_status['by_whom'], 'anotheruser')
                self.assertEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(validation_status['by_whom'], 'anotheruser')
                self.assertNotEqual(
                    validation_status['uid'],
                    data['payload']['validation_status.uid']
                )

        # TODO Test with `query` when Mockbackend support Mongo queries


class SubmissionGeoJsonApiTests(BaseTestCase):

    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        self.someuser = User.objects.get(username="someuser")
        self.asset = a = Asset()
        a.name = 'Two points and one text'
        a.owner = self.someuser
        a.asset_type = 'survey'
        a.content = {'survey': [
            {'name': 'geo1', 'type': 'geopoint', 'label': 'Where were you?'},
            {'name': 'geo2', 'type': 'geopoint', 'label': 'Where are you?'},
            {'name': 'text', 'type': 'text', 'label': 'How are you?'},
        ]}
        a.save()
        a.deploy(backend='mock', active=True)
        a.save()

        v_uid = a.latest_deployed_version.uid
        self.submissions = [
            {
                '__version__': v_uid,
                'geo1': '10.11 10.12 10.13 10.14',
                'geo2': '10.21 10.22 10.23 10.24',
                'text': 'Tired',
            },
            {
                '__version__': v_uid,
                'geo1': '20.11 20.12 20.13 20.14',
                'geo2': '20.21 20.22 20.23 20.24',
                'text': 'Relieved',
            },
            {
                '__version__': v_uid,
                'geo1': '30.11 30.12 30.13 30.14',
                'geo2': '30.21 30.22 30.23 30.24',
                'text': 'Excited',
            },
        ]
        a.deployment.mock_submissions(self.submissions)
        a.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = a.deployment.submission_list_url

    def test_list_submissions_geojson_defaults(self):
        response = self.client.get(
            self.submission_list_url,
            {'format': 'geojson'}
        )
        expected_output = {
            'type': 'FeatureCollection',
            'name': 'Two points and one text',
            'features': [
                {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [10.12, 10.11, 10.13],
                    },
                    'properties': {'text': 'Tired'},
                },
                {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [20.12, 20.11, 20.13],
                    },
                    'properties': {'text': 'Relieved'},
                },
                {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [30.12, 30.11, 30.13],
                    },
                    'properties': {'text': 'Excited'},
                },
            ],
        }
        assert expected_output == json.loads(response.content)

    def test_list_submissions_geojson_other_geo_question(self):
        response = self.client.get(
            self.submission_list_url,
            {'format': 'geojson', 'geo_question_name': 'geo2'},
        )
        expected_output = {
            'name': 'Two points and one text',
            'type': 'FeatureCollection',
            'features': [
                {
                    'type': 'Feature',
                    'geometry': {
                        'coordinates': [10.22, 10.21, 10.23],
                        'type': 'Point',
                    },
                    'properties': {'text': 'Tired'},
                },
                {
                    'type': 'Feature',
                    'geometry': {
                        'coordinates': [20.22, 20.21, 20.23],
                        'type': 'Point',
                    },
                    'properties': {'text': 'Relieved'},
                },
                {
                    'type': 'Feature',
                    'geometry': {
                        'coordinates': [30.22, 30.21, 30.23],
                        'type': 'Point',
                    },
                    'properties': {'text': 'Excited'},
                },
            ],
        }
        assert expected_output == json.loads(response.content)
