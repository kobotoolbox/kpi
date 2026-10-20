import copy
import json
import os
import random
import string
import unittest
import uuid

import responses
from constance.test import override_config
from django.conf import settings
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    remove_uuid_prefix,
)
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kobo.apps.openrosa.libs.utils.common_tags import (
    META_ROOT_UUID,
)
from kobo.apps.project_ownership.utils import create_invite
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.utils.mixins import (
    SubmissionDeleteTestCaseMixin,
    SubmissionViewTestCaseMixin,
)
from kpi.tests.utils.mock import (
    enketo_view_instance_response,
)
from kpi.tests.utils.transaction import immediate_on_commit
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.fuzzy_int import FuzzyInt
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.object_permission import get_anonymous_user


class BaseSubmissionTestCase(BaseTestCase):
    """
    Force JSON to test the API by specifying `format` (GET requests)
    or `HTTP_ACCEPT` (other requests)
    """

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.unknownuser = User.objects.create(username='unknownuser')
        UserProfile.objects.create(user=self.unknownuser)

        content_source_asset = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(
            content=content_source_asset.content,
            owner=self.someuser,
            asset_type='survey',
        )

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'uid_asset': self.asset.uid, 'format': 'json'},
        )
        self._deployment = self.asset.deployment

    def _add_submissions(self, other_fields: dict = None):
        letters = string.ascii_letters
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid
        self.submissions_submitted_by_someuser = []
        self.submissions_submitted_by_unknownuser = []
        self.submissions_submitted_by_anotheruser = []

        submitted_by_choices = ['unknownuser', 'someuser', 'anotheruser']
        for submitted_by in submitted_by_choices:
            for i in range(2):
                uuid_ = uuid.uuid4()
                submission = {
                    '__version__': v_uid,
                    'q1': ''.join(random.choice(letters) for letter in range(10)),
                    'q2': ''.join(random.choice(letters) for letter in range(10)),
                    'meta/instanceID': f'uuid:{uuid_}',
                    '_uuid': str(uuid_),
                    '_submitted_by': submitted_by,
                }
                if other_fields is not None:
                    submission.update(**other_fields)

                submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions)

        self.submissions_submitted_by_unknownuser = submissions[0:2]
        self.submissions_submitted_by_someuser = submissions[2:4]
        self.submissions_submitted_by_anotheruser = submissions[4:6]
        self.submissions = submissions

    def _create_other_project_with_submissions(self):
        """
        Create a second deployed project owned by `anotheruser` with its own
        submissions and return the list of its PostgreSQL `Instance` ids.
        """
        content_source_asset = Asset.objects.get(id=1)
        other_asset = Asset.objects.create(
            content=content_source_asset.content,
            owner=self.anotheruser,
            asset_type='survey',
        )
        other_asset.deploy(backend='mock', active=True)
        v_uid = other_asset.latest_deployed_version.uid
        submissions = []
        for i in range(2):
            uuid_ = uuid.uuid4()
            submissions.append(
                {
                    '__version__': v_uid,
                    'q1': 'foreign',
                    'meta/instanceID': f'uuid:{uuid_}',
                    '_uuid': str(uuid_),
                    '_submitted_by': 'anotheruser',
                }
            )
        other_asset.deployment.mock_submissions(submissions)
        return list(
            Instance.objects.filter(
                xform__kpi_asset_uid=other_asset.uid
            ).values_list('id', flat=True)
        )


class BulkDeleteSubmissionsApiTests(
    SubmissionDeleteTestCaseMixin, BaseSubmissionTestCase
):

    # TODO, Add tests with ids and query

    def setUp(self):
        super().setUp()

        self._add_submissions()
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'uid_asset': self.asset.uid, 'format': 'json'},
        )
        self.submission_bulk_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'uid_asset': self.asset.uid,
            },
        )

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_delete_submissions_after_transfer(self):
        """
        someuser has transfered the project to anotheruser
        someuser can delete anotheruser's project data after transfer
        """
        # Transfer the project to anotheruser
        with immediate_on_commit():
            create_invite(
                self.someuser,
                self.anotheruser,
                [self.asset],
                'Invite'
            )
        self.asset.refresh_from_db()
        assert self.asset.owner == self.anotheruser

        self._delete_submissions()

    def test_delete_submissions_as_owner(self):
        """
        someuser is the project owner
        someuser can delete their own data
        """
        self._delete_submissions()

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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
        data = {'payload': {'confirm': True}}

        response = self.client.delete(self.submission_bulk_url,
                                      data=data,
                                      format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], 0)

    def test_cannot_delete_submissions_of_another_project(self):
        """
        someuser owns `self.asset`. They must not be able to delete the
        submissions of another project by passing foreign ids to their own
        project bulk-delete endpoint. The request is rejected (400) and the
        foreign data is left untouched.
        """
        foreign_ids = self._create_other_project_with_submissions()
        assert len(foreign_ids) == 2

        self.client.force_login(self.someuser)
        data = {'payload': {'submission_ids': foreign_ids}}
        response = self.client.delete(
            self.submission_bulk_url, data=data, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # The foreign submissions must still exist
        assert (
            Instance.objects.filter(id__in=foreign_ids).count() == len(foreign_ids)
        )

    def test_delete_submissions_rejects_whole_batch_if_one_id_is_foreign(self):
        """
        A batch mixing someuser's own ids with a foreign id must be rejected
        entirely (strict): none of the submissions — own or foreign — are
        deleted.
        """
        foreign_ids = self._create_other_project_with_submissions()
        own_ids = list(
            Instance.objects.filter(
                xform__kpi_asset_uid=self.asset.uid
            ).values_list('id', flat=True)
        )
        assert own_ids and foreign_ids

        self.client.force_login(self.someuser)
        data = {'payload': {'submission_ids': own_ids[:1] + foreign_ids[:1]}}
        response = self.client.delete(
            self.submission_bulk_url, data=data, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Nothing was deleted: both the own and the foreign submissions remain
        assert Instance.objects.filter(id__in=own_ids).count() == len(own_ids)
        assert (
            Instance.objects.filter(id__in=foreign_ids).count() == len(foreign_ids)
        )

        # No phantom DELETE_SUBMISSION audit log entries for the rejected batch
        assert not ProjectHistoryLog.objects.filter(
            object_id=self.asset.id, action=AuditAction.DELETE_SUBMISSION
        ).exists()

    def test_delete_all_allowed_submissions_with_partial_perms_as_anotheruser(self):
        """
        someuser is the project owner.
        anotheruser has partial permissions and can view and delete their own
        submitted data

        Test that anotheruser can delete all their data at once and if they do,
        only delete their data.
        """
        self.client.force_login(self.anotheruser)
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
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], 0)

        # Ensure anotheruser only deleted their submissions
        # Log in as the owner of the project: `someuser`. They can retrieve all
        # submissions
        self.login_as_other_user('someuser', 'someuser')
        response = self.client.get(self.submission_list_url, {'format': 'json'})

        unknown_submission_ids = [
            sub['_id'] for sub in self.submissions_submitted_by_unknownuser
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
        self.client.force_login(self.anotheruser)
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
        submissions = self.submissions_submitted_by_unknownuser
        data = {'payload': {'submission_ids': [submissions[0]['_id']]}}
        response = self.client.delete(
            self.submission_bulk_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        count = self._deployment.calculated_submission_count(self.anotheruser)
        assert count == 2
        submissions = self.submissions_submitted_by_anotheruser
        data = {
            'payload': {
                'submission_ids': [submissions[0]['_id']],
            }
        }
        response = self.client.delete(
            self.submission_bulk_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], count - 1)

    def test_cant_delete_view_only_submissions_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project
        anotheruser is allowed to view someuser's data and delete their own data

        Test that anotheruser cannot delete someuser's data
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'someuser'}],
            # view_submission is implied
            PERM_DELETE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
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


class SubmissionApiTests(SubmissionDeleteTestCaseMixin, BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self._add_submissions()

    def test_cannot_create_submission(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anotheruser has view access on someuser's data

        Test that no one can create submissions (with KPI endpoint)
        """
        submission = {
            'q1': 'a5',
            'q2': 'a6',
        }
        # Owner
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Shared
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Anonymous
        self.client.logout()
        response = self.client.post(self.submission_list_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_query_counts_for_list_submissions(self):
        # query count differs when stripe is enabled/disabled
        with self.assertNumQueries(FuzzyInt(17, 19)):
            # regular
            self.client.get(self.submission_list_url, {'format': 'json'})
        with self.assertNumQueries(FuzzyInt(17, 19)):
            # with params
            self.client.get(
                self.submission_list_url,
                {
                    'format': 'json',
                    'start': 1,
                    'limit': 5,
                    'sort': '{"q1": -1}',
                    'fields': '["q1", "_submitted_by"]',
                    'query': '{"_submitted_by": {'
                             '  "$in": '
                             '    ["unknownuser", "someuser", "anotheruser"]'
                             ' }'
                             '}',
                },
            )

    def test_query_count_does_not_increase_with_more_submissions(self):
        with CaptureQueriesContext(connection) as context:
            self.client.get(self.submission_list_url, {'format': 'json'})
        count = context.final_queries - context.initial_queries
        # add a few submissions
        self._add_submissions()
        with self.assertNumQueries(FuzzyInt(count - 1, count)):
            self.client.get(self.submission_list_url, {'format': 'json'})
        # get second page
        with self.assertNumQueries(FuzzyInt(count - 1, count)):
            self.client.get(
                self.submission_list_url, {
                    'format': 'json',
                    'start': 6,
                    'limit': 5
                }
            )

    def test_list_submissions_as_owner(self):
        """
        someuser is the owner of the project.
        They can list their own data
        """
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_ids = [r['_id'] for r in response.data.get('results')]
        submissions_ids = [s['_id'] for s in self.submissions]
        self.assertEqual(sorted(response_ids), sorted(submissions_ids))

    def test_list_submissions_as_owner_with_params(self):
        """
        someuser is the owner of the project.
        They can list their own data and they can narrow down the results with
        params
        """
        response = self.client.get(
            self.submission_list_url,
            {
                'format': 'json',
                'start': 1,
                'limit': 5,
                'sort': '{"q1": -1}',
                'fields': '["q1", "_submitted_by"]',
                'query': '{"_submitted_by": {'
                         '  "$in": '
                         '    ["unknownuser", "someuser", "anotheruser"]'
                         ' }'
                         '}',
            },
        )
        # ToDo add more assertions. E.g. test whether sort, limit, start really work
        self.assertEqual(len(response.data['results']), 5)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_submissions_limit(self):
        """
        someuser is the owner of the project.
        Test that hard-coded maximum limit cannot be exceeded by user's requests.
        """

        limit = settings.MAX_API_PAGE_SIZE
        excess = 10
        asset = Asset.objects.create(
            name='Lots of submissions',
            owner=self.asset.owner,
            content={'survey': [{'label': 'q', 'type': 'integer'}]},
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
        submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'uid_asset': asset.uid, 'format': 'json'},
        )

        # Server-wide default limit should apply if no limit specified
        response = self.client.get(submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), settings.DEFAULT_API_PAGE_SIZE)
        # Limit specified in query parameters should not be able to exceed
        # the server-wide limit
        response = self.client.get(
            submission_list_url, {'limit': limit + excess, 'format': 'json'}
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
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access on someuser's data. They can view all
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_ids = [r['_id'] for r in response.data.get('results')]
        submissions_ids = [s['_id'] for s in self.submissions]
        self.assertEqual(sorted(response_ids), sorted(submissions_ids))

    def test_list_submissions_with_partial_permissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view access on someuser's project.
        They can view only the data they submitted to someuser's project.
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # User `anotheruser` should only see submissions where `submitted_by`
        # is filled in and equals to `anotheruser`
        viewable_submission_count = len(self.submissions_submitted_by_anotheruser)
        self.assertTrue(response.data.get('count') == viewable_submission_count)
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
        response = self.client.get(self.submission_list_url, {'format': 'json'})
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
        response = self.client.get(self.submission_list_url, {'format': 'json'})
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
        self.client.force_login(self.anotheruser)

        # Give the user who will access the public data--without any explicit
        # permission assignment--their own asset. This is needed to expose a
        # flaw in `ObjectPermissionMixin.__get_object_permissions()`
        Asset.objects.create(name='i own it', owner=self.anotheruser)

        # `self.asset` is owned by `someuser`; `anotheruser` has no
        # explicitly-granted access to it
        self.asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.asset.remove_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)

    def test_list_subs_asset_publicly_shared_and_shared_with_user_as_anotheruser(self):
        """
        Running through behaviour described in issue kpi/#2870 where an asset
        that has been publicly shared and then explicity shared with a user, the
        user has lower permissions than an anonymous and is therefore
        unable to view submission data.
        """

        self.client.force_login(self.anotheruser)
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

    def test_list_query_elem_match(self):
        """
        Ensure query is able to filter on an array
        """
        submission = copy.deepcopy(self.submissions_submitted_by_someuser[0])
        del submission['_id']
        uuid_ = str(uuid.uuid4())
        submission['meta/instanceID'] = f'uuid:{uuid_}'
        submission['_uuid'] = str(uuid_)
        group = 'group_lx4sf58'
        question = 'q3'
        submission[group] = [
            {
                f'{group}/{question}': 'whap.gif',
            },
            {
                f'{group}/{question}': 'whop.gif',
            },
        ]

        self.asset.deployment.mock_submissions([submission])

        data = {
            'query': f'{{"{group}":{{"$elemMatch":{{"{group}/{question}":{{"$exists":true}}}}}}}}',  # noqa: E501
            'format': 'json',
        }
        response = self.client.get(self.submission_list_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        if isinstance(response.data, list):
            response_count = len(response.data)
        else:
            response_count = response.data.get('count')
        self.assertEqual(response_count, 1)

    def test_retrieve_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can view one of their submission.
        """
        submission = self.submissions_submitted_by_someuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_id'], submission['_id'])

    def test_retrieve_submission_by_uuid(self):
        """
        someuser is the owner of the project.
        someuser can view one of their submission.
        """
        submission = self.submissions[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_uuid'],
            },
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_id'], submission['_id'])

    def test_retrieve_submission_by_root_uuid(self):
        """
        someuser is the owner of the project.
        someuser can view one of their submission.
        """

        submission = settings.MONGO_DB.instances.find_one(
            {'_id': self.submissions[0]['_id']}
        )

        # fake edit
        old_uuid = submission['meta/instanceID']
        submission['meta/deprecatedID'] = old_uuid
        submission['meta/rootUuid'] = old_uuid
        submission['meta/instanceID'] = 'foo:bar'
        submission['_uuid'] = 'foo:bar'
        MongoHelper.replace_one(submission)

        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['meta/rootUuid'],
            },
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_id'], submission['_id'])
        self.assertEqual(response.data['_uuid'], 'foo:bar')
        self.assertEqual(response.data['meta/rootUuid'], old_uuid)

    def test_retrieve_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has no access to someuser's data
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_submission_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access to someuser's data.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_id'], submission['_id'])

    def test_retrieve_submission_with_partial_permissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view access to someuser's data.
        They can only see their own data.
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Try second submission submitted by another
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can delete their own data.
        """
        submission = self.submissions_submitted_by_someuser[0]
        self._delete_submission(submission)

    def test_delete_not_existing_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser should receive a 404 if they try to delete a non-existing
        submission.
        """
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': 9999,
            },
        )
        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_as_anonymous(self):
        """
        someuser is the owner of the project.
        The project is not shared publicly.
        anonymous cannot view someuser's data, therefore they cannot delete it
        someuser's data existence should not be revealed.
        """
        self.client.logout()
        submission = self.submissions_submitted_by_someuser[0]

        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_not_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anynone.
        anotheruser cannot view someuser's data, therefore they cannot delete it.
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_shared_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has view access to someuser's data.
        anotheruser can view someuser's data but they cannot delete it.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # `another_user` should not be able to delete with 'change_submissions'
        # permission.
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Let's assign them 'delete_submissions'. Everything should be ok then!
        self.asset.assign_perm(self.anotheruser, PERM_DELETE_SUBMISSIONS)
        response = self.client.delete(url, headers={'accept': 'application/json'})
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(response.data['count'], len(self.submissions) - 1)

    def test_delete_submission_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial access to someuser's data.
        anotheruser can only view/delete their data.
        """
        self.client.force_login(self.anotheruser)
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
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.delete(
            url, content_type='application/json', headers={'accept': 'application/json'}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        anotheruser_submission_count = len(self.submissions_submitted_by_anotheruser)
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.delete(
            url, content_type='application/json', headers={'accept': 'application/json'}
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(
            response.data['count'], anotheruser_submission_count - 1
        )

    @unittest.skip('TODO: refactor attachments so that this test passes')
    def test_attachments_rewrite(self):
        """
        Test:
        - xpath detections for repeated group, nested group and non-latin
          characters at the same
        - attachment endpoints related to KPI domain name
        """
        content = {
            'survey': [
                {
                    'name': 'group_ec9yq67',
                    'type': 'begin_group',
                    '$kuid': 'zo3lt68',
                    'label': ['3 levels'],
                    'required': False,
                },
                {
                    'name': 'group_dq8as25',
                    'type': 'begin_repeat',
                    '$kuid': 'mg3vt38',
                    'label': ['Repeated group - Upper level'],
                    'required': False,
                },
                {
                    'name': 'group_xt0za80',
                    'type': 'begin_repeat',
                    '$kuid': 'pp7xz89',
                    'label': ['Repeated group - Nested'],
                    'required': False,
                },
                {
                    'type': 'image',
                    '$kuid': 'ra2ti71',
                    'label': ['my_attachment'],
                    'required': False,
                },
                {'type': 'end_repeat', '$kuid': '/pp7xz89'},
                {'type': 'end_repeat', '$kuid': '/mg3vt38'},
                {'type': 'end_group', '$kuid': '/zo3lt68'},
            ],
            'settings': {},
            'translated': ['label'],
            'translations': [None],
        }

        asset = Asset.objects.create(
            content=content,
            owner=self.anotheruser,
            asset_type=ASSET_TYPE_SURVEY,
        )

        asset.deploy(backend='mock', active=True)
        asset.save()  # create version
        v_uid = asset.latest_deployed_version.uid

        submission = {
            '__version__': v_uid,
            '_xform_id_string': asset.uid,
            'formhub/uuid': 'formhub-uuid',
            '_uuid': 'submission-uuid',
            'group_ec9yq67/group_dq8as25': [
                {
                    'group_ec9yq67/group_dq8as25/group_xt0za80': [
                        {
                            'group_ec9yq67/group_dq8as25/group_xt0za80/my_attachment':
                                'IMG_4266-11_38_22.jpg'
                        },
                        {
                            'group_ec9yq67/group_dq8as25/group_xt0za80/my_attachment':
                                'كوبو-رائع-10_7_41.jpg'
                        },
                    ]
                },
                {
                    'group_ec9yq67/group_dq8as25/group_xt0za80': [
                        {
                            'group_ec9yq67/group_dq8as25/group_xt0za80/my_attachment':
                                'Screenshot 2024-02-14 at 18.31.39-11_38_35.jpg'
                        }
                    ]
                },
            ],
            '_attachments': [
                {
                    'download_url': 'http://kc.testserver/1.jpg',
                    'download_large_url': 'http://kc.testserver/1.jpg',
                    'download_medium_url': 'http://kc.testserver/1.jpg',
                    'download_small_url': 'http://kc.testserver/1.jpg',
                    'mimetype': 'image/jpeg',
                    'filename': os.path.join(
                        'anotheruser',
                        'attachments',
                        'formhub-uuid',
                        'submission-uuid',
                        'IMG_4266-11_38_22.jpg'
                    ),
                    'instance': 1,
                    'xform': 1,
                    'id': 1,
                },
                {
                    'download_url': 'http://kc.testserver/2.jpg',
                    'download_large_url': 'http://kc.testserver/2.jpg',
                    'download_medium_url': 'http://kc.testserver/2.jpg',
                    'download_small_url': 'http://kc.testserver/2.jpg',
                    'mimetype': 'image/jpeg',
                    'filename': os.path.join(
                        'anotheruser',
                        'attachments',
                        'formhub-uuid',
                        'submission-uuid',
                        'كوبو-رايع-10_7_41.jpg'
                    ),
                    'instance': 1,
                    'xform': 1,
                    'id': 2,
                },
                {
                    'download_url': 'http://kc.testserver/3.jpg',
                    'download_large_url': 'http://kc.testserver/3.jpg',
                    'download_medium_url': 'http://kc.testserver/3.jpg',
                    'download_small_url': 'http://kc.testserver/3.jpg',
                    'mimetype': 'image/jpeg',
                    'filename': os.path.join(
                        'anotheruser',
                        'attachments',
                        'formhub-uuid',
                        'submission-uuid',
                        'Screenshot_2024-02-14_at_18.31.39-11_38_35.jpg'
                    ),
                    'instance': 1,
                    'xform': 1,
                    'id': 3,
                },
            ],
        }

        asset.deployment.mock_submissions([submission])
        asset.deployment.set_namespace(self.URL_NAMESPACE)

        self.client.force_login(self.anotheruser)
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        attachments = response.data['_attachments']

        expected_question_xpaths = [
            'group_ec9yq67/group_dq8as25[1]/group_xt0za80[1]/my_attachment',
            'group_ec9yq67/group_dq8as25[1]/group_xt0za80[2]/my_attachment',
            'group_ec9yq67/group_dq8as25[2]/group_xt0za80[1]/my_attachment'
        ]

        submission_id = submission['_id']
        attachment_0_uid = attachments[0]['uid']
        attachment_1_uid = attachments[1]['uid']
        attachment_2_uid = attachments[2]['uid']

        expected_new_download_urls = [
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_0_uid}/?format=json',
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_1_uid}/?format=json',
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_2_uid}/?format=json',
        ]

        for idx, attachment in enumerate(attachments):
            assert attachment['download_url'] == expected_new_download_urls[idx]
            assert attachment['question_xpath'] == expected_question_xpaths[idx]

    def test_inject_requires_properties_if_not_present(self):
        """
        Ensure `meta/rootUUid` and `_validation_status` are present in API response
        even if not present (e.g. like old submissions)
        """
        # remove "meta/rootUuid" from MongoDB
        submission = self.submissions_submitted_by_someuser[0]
        mongo_document = settings.MONGO_DB.instances.find_one(
            {'_id': submission['_id']}
        )
        root_uuid = mongo_document.pop(META_ROOT_UUID)
        settings.MONGO_DB.instances.update_one(
            {'_id': submission['_id']},
            {'$unset': {META_ROOT_UUID: root_uuid, '_validation_status': None}},
        )

        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        assert response.data['_id'] == submission['_id']
        assert META_ROOT_UUID in response.data
        assert '_validation_status' in response.data
        assert response.data[META_ROOT_UUID] == root_uuid
        assert response.data['_validation_status'] == {}

    def test_supplement_fallback_to_instance_id(self):
        """
        If a submission is missing `meta/rootUuid` in MongoDB, the `supplement`
        endpoint should fallback to `meta/instanceID` (`_uuid`) and still retrieve the
        supplement.
        """
        submission = self.submissions_submitted_by_someuser[0]
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )

        mongo_document = settings.MONGO_DB.instances.find_one(
            {'_id': submission['_id']}
        )
        root_uuid = mongo_document.pop(META_ROOT_UUID)
        settings.MONGO_DB.instances.update_one(
            {'_id': submission['_id']},
            {'$unset': {META_ROOT_UUID: root_uuid}},
        )

        supplement_data = {
            'q1': {
                'manual_transcription': {
                    '_versions': [
                        {
                            '_data': {'language': 'en', 'value': 'Bonjour'},
                        }
                    ],
                },
            },
            '_version': '20250820',
        }
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=remove_uuid_prefix(submission['_uuid']),
            content=supplement_data,
        )

        url = reverse(
            self._get_endpoint('submission-supplement'),
            kwargs={
                'uid_asset': self.asset.uid,
                'root_uuid': submission['_uuid'],
            },
        )
        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_version'], '20250820')

    def test_submitted_by_persists_after_user_deletion(self):
        # Simulate old submissions that don't have `submitted_by`
        ParsedInstance.objects.filter(instance__user=self.anotheruser).update(
            submitted_by=None
        )
        self.anotheruser.delete()
        for submission in self.submissions_submitted_by_anotheruser:
            url = reverse(
                self._get_endpoint('submission-detail'),
                kwargs={
                    'uid_asset': self.asset.uid,
                    'pk': submission['_id'],
                },
            )
            response = self.client.get(url)
            assert response.status_code == status.HTTP_200_OK
            assert response.data['_submitted_by'] == 'anotheruser'

    def test_get_data_with_failed_transcription_no_value(self):
        """
        When a transcription fails (e.g., no audio attachment), the stored
        data may not have a 'value' field. Reading this data should not
        crash with a 500 error.
        """

        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',  # q1 is not an audio question, but works for tests
            action='automatic_google_transcription',
            params=[{'language': 'fr'}],
        )
        # Create a mock submission supplement with no 'value' field
        failed_transcription_data = {
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-11T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'status': 'failed',
                                'error': 'Any error',
                            },
                            '_dateCreated': '2026-01-11T01:29:00.908261Z',
                            '_uuid': '08668365-c922-48ea-9f0e-26935ca2755e',
                        }
                    ],
                }
            },
            '_version': '20250820',
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submissions[0]['_uuid'],
            content=failed_transcription_data,
        )
        data_url = reverse(self._get_endpoint('submission-list'), args=[self.asset.uid])
        response = self.client.get(data_url, format='json')
        assert response.status_code == status.HTTP_200_OK

    def test_simplified_supplemental_detail_for_delete(self):

        # q1 is not an audio question in the asset, but works fine for this test anyway.
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',  # q1 is not an audio question, but works for tests
            action='automatic_google_transcription',
            params=[{'language': 'fr'}],
        )
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'fr'}],
        )
        # Create a mock submission supplement with the following scenario:
        # - Question has been manually transcribed
        # - Question has been automatically transcribed
        # - Manual transcription has been deleted
        transcription_data = {
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-11T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'fr',
                                'status': 'completed',
                                'value': 'Bonjour le monde!',
                            },
                            '_dateAccepted': '2026-01-11T01:29:00.908261Z',
                            '_dateCreated': '2026-01-11T01:29:00.908261Z',
                            '_uuid': '08668365-c922-48ea-9f0e-26935ca2755e',
                        }
                    ],
                },
                'manual_transcription': {
                    '_dateCreated': '2026-01-10T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:30:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'value': None,
                            },
                            '_dateCreated': '2026-01-11T01:30:00.908261Z',
                            '_uuid': '2222222-2222-2222-2222-222222222222',
                        },
                        {
                            '_data': {'language': 'en', 'value': 'Bonjour la foule!'},
                            '_dateCreated': '2026-01-10T01:29:00.908261Z',
                            '_dateAccepted': '2026-01-10T01:29:00.908261Z',
                            '_uuid': '1111111-1111-1111-1111-111111111111',
                        },
                    ],
                },
            },
            '_version': '20250820',
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submissions[0]['_uuid'],
            content=transcription_data,
        )
        data_url = reverse(self._get_endpoint('submission-list'), args=[self.asset.uid])
        response = self.client.get(data_url, format='json')
        assert response.status_code == status.HTTP_200_OK
        # The manual deletion is newer than the accepted automatic transcription,
        # so the transcript is omitted instead of falling back to the automatic one
        assert (
            'transcript'
            not in response.data['results'][0]['_supplementalDetails']['q1']
        )

    def test_simplified_supplemental_detail_for_acceptance(self):

        # q1 is not an audio question in the asset, but works fine for this test anyway.
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',  # q1 is not an audio question, but works for tests
            action='automatic_google_transcription',
            params=[{'language': 'fr'}],
        )
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'fr'}],
        )
        # Create a mock submission supplement with the following scenario:
        # - Question has been manually transcribed
        # - Question has been automatically transcribed
        # - Manual transcription has been deleted
        transcription_data = {
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-11T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'fr',
                                'status': 'completed',
                                'value': 'Bonjour le monde!',
                            },
                            '_dateCreated': '2026-01-11T01:29:00.908261Z',
                            '_uuid': '08668365-c922-48ea-9f0e-26935ca2755e',
                        }
                    ],
                },
                'manual_transcription': {
                    '_dateCreated': '2026-01-10T01:29:00.908261Z',
                    '_dateModified': '2026-01-10T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {'language': 'en', 'value': 'Bonjour la foule!'},
                            '_dateCreated': '2026-01-10T01:29:00.908261Z',
                            '_dateAccepted': '2026-01-10T01:29:00.908261Z',
                            '_uuid': '1111111-1111-1111-1111-111111111111',
                        }
                    ],
                },
            },
            '_version': '20250820',
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submissions[0]['_uuid'],
            content=transcription_data,
        )
        data_url = reverse(self._get_endpoint('submission-list'), args=[self.asset.uid])
        response = self.client.get(data_url, format='json')
        assert response.status_code == status.HTTP_200_OK
        # The automatic transcription is newer but unaccepted (pending), so it
        # beats the older accepted manual transcription
        transcript = (
            response.data['results'][0]['_supplementalDetails']['q1']['transcript']
        )
        assert transcript.get('pendingReview') is True
        assert transcript['value'] == ''

        transcription_data['q1']['automatic_google_transcription']['_versions'][0][
            '_dateAccepted'
        ] = '2026-01-11T01:29:00.908261Z'

        SubmissionSupplement.objects.filter(
            asset=self.asset,
            submission_uuid=self.submissions[0]['_uuid'],
        ).update(content=transcription_data)

        data_url = reverse(self._get_endpoint('submission-list'), args=[self.asset.uid])
        response = self.client.get(data_url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert (
            response.data['results'][0]['_supplementalDetails']['q1']['transcript'][
                'value'
            ]
            == 'Bonjour le monde!'
        )


class SubmissionViewApiTests(SubmissionViewTestCaseMixin, BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.submission = self.submissions_submitted_by_someuser[0]
        self.submission_view_link_url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_view_redirect_url = reverse(
            self._get_endpoint('submission-enketo-view-redirect'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        assert 'redirect' in self.submission_view_redirect_url

    @responses.activate
    def test_get_view_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can get enketo view link
        """
        self._get_view_link()

    @responses.activate
    def test_get_view_submission_redirect_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can get enketo view link
        """
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_VIEW_INSTANCE_ENDPOINT}'
        )

        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_view_instance_response,
            content_type='application/json',
        )

        response = self.client.get(
            self.submission_view_redirect_url, {'format': 'json'}
        )
        assert response.status_code == status.HTTP_302_FOUND
        assert (
            response.url
            == f"{settings.ENKETO_URL}/view/{self.submission['_uuid']}"
        )

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
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @responses.activate
    def test_get_view_link_submission_shared_with_view_only_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has 'view_submissions' permissions.
        anotheruser can retrieve enketo view link.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)

        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_VIEW_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_view_instance_response,
            content_type='application/json',
        )

        response = self.client.get(self.submission_view_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    @responses.activate
    def test_get_view_link_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial view permissions on someuser's data
        anotheruser can only view their own data
        """
        self.client.force_login(self.anotheruser)
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
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'uid_asset': self.asset.uid,
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
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_VIEW_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_view_instance_response,
            content_type='application/json',
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_response = {
            'url': f"{settings.ENKETO_URL}/view/{submission['_uuid']}",
            'version_uid': self.asset.latest_deployed_version.uid,
        }
        self.assertEqual(response.data, expected_response)


class SubmissionGeoJsonApiTests(BaseTestCase):

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
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
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={
                'uid_asset': a.uid,
            },
        )

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
