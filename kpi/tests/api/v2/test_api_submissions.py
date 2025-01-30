import copy
import json
import os
import random
import string
import uuid
from datetime import datetime
from unittest import mock
from zoneinfo import ZoneInfo

import lxml
import pytest
import responses
from django.conf import settings
from django.core.files.base import ContentFile
from django.urls import reverse
from django_digest.test import Client as DigestClient
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import InstanceIdMissingError
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import dict2xform
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.utils.mixins import (
    SubmissionDeleteTestCaseMixin,
    SubmissionEditTestCaseMixin,
    SubmissionValidationStatusTestCaseMixin,
    SubmissionViewTestCaseMixin,
)
from kpi.tests.utils.mock import (
    enketo_edit_instance_response,
    enketo_edit_instance_response_with_root_name_validation,
    enketo_edit_instance_response_with_uuid_validation,
    enketo_view_instance_response,
)
from kpi.tests.utils.xml import get_form_and_submission_tag_names
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


def dict2xform_with_namespace(submission: dict, xform_id_string: str) -> str:
    xml_string = dict2xform(submission, xform_id_string)
    xml_root = lxml.etree.fromstring(xml_string.encode())
    xml_root.set('xmlns', 'http://opendatakit.org/submissions')
    return xml_tostring(xml_root)


class BaseSubmissionTestCase(BaseTestCase):
    """
    DataViewset uses `BrowsableAPIRenderer` as the first renderer.
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
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
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


class BulkDeleteSubmissionsApiTests(
    SubmissionDeleteTestCaseMixin, BaseSubmissionTestCase
):

    # TODO, Add tests with ids and query

    def setUp(self):
        super().setUp()

        self._add_submissions()
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
        limit = settings.SUBMISSION_LIST_LIMIT
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
            kwargs={'parent_lookup_asset': asset.uid, 'format': 'json'},
        )

        # Server-wide limit should apply if no limit specified
        response = self.client.get(submission_list_url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), limit)
        # Limit specified in query parameters should not be able to exceed
        # server-wide limit
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
                'parent_lookup_asset': self.asset.uid,
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
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_uuid'],
            },
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['_id'], submission['_id'])

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
                'parent_lookup_asset': self.asset.uid,
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
                'parent_lookup_asset': self.asset.uid,
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
                'parent_lookup_asset': self.asset.uid,
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
                'parent_lookup_asset': self.asset.uid,
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
                'parent_lookup_asset': self.asset.uid,
                'pk': 9999,
            },
        )
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
        submission = self.submissions_submitted_by_someuser[0]

        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
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
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
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
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
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
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.delete(
            url, content_type='application/json', HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        anotheruser_submission_count = len(self.submissions_submitted_by_anotheruser)
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.delete(
            url, content_type='application/json', HTTP_ACCEPT='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(
            response.data['count'], anotheruser_submission_count - 1
        )

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
                'parent_lookup_asset': asset.uid,
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
        attachment_0_id = submission['_attachments'][0]['id']
        attachment_1_id = submission['_attachments'][1]['id']
        attachment_2_id = submission['_attachments'][2]['id']

        expected_new_download_urls = [
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_0_id}/?format=json',
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_1_id}/?format=json',
            'http://testserver/api/v2/assets/'
            + asset.uid
            + f'/data/{submission_id}/attachments/{attachment_2_id}/?format=json',
        ]

        for idx, attachment in enumerate(attachments):
            assert attachment['download_url'] == expected_new_download_urls[idx]
            assert attachment['question_xpath'] == expected_question_xpaths[idx]


class SubmissionEditApiTests(SubmissionEditTestCaseMixin, BaseSubmissionTestCase):
    """
    Tests for editin submissions.

    WARNING: Tests in this class must work in v1 as well, or else be added to the
    skipped tests in kpi/tests/api/v1/test_api_submissions.py
    """

    def setUp(self):
        super().setUp()

        self._add_submissions()
        self.submission = self.submissions_submitted_by_someuser[0]
        self.submission_url_legacy = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_url = self.submission_url_legacy.replace(
            'edit', 'enketo/edit'
        )
        self.submission_redirect_url = self.submission_url_legacy.replace(
            'edit', 'enketo/redirect/edit'
        )
        assert 'redirect' in self.submission_redirect_url

    @responses.activate
    def test_get_legacy_edit_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link through old API endpoint
        """
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        response = self.client.get(self.submission_url_legacy, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

        expected_response = {
            'url': f"{settings.ENKETO_URL}/edit/{self.submission['_uuid']}",
            'version_uid': self.asset.latest_deployed_version.uid,
        }
        assert response.data == expected_response

    @responses.activate
    def test_get_edit_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link
        """
        self._get_edit_link()

    @responses.activate
    def test_get_edit_submission_redirect_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link
        """
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        response = self.client.get(
            self.submission_redirect_url, {'format': 'json'}
        )
        assert response.status_code == status.HTTP_302_FOUND
        assert (
            response.url
            == f"{settings.ENKETO_URL}/edit/{self.submission['_uuid']}"
        )

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
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_get_edit_link_submission_shared_with_view_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser can only view the project, therefore they cannot edit data.
        someuser's data existence should not be revealed.
        """
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.submission_url, {'format': 'json'})

        # FIXME if anotheruser has view permissions, they should receive a 403
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @responses.activate
    def test_get_edit_link_submission_shared_with_edit_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has 'change_submissions' permissions.
        anotheruser can retrieve enketo edit link
        """
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        self.client.force_login(self.anotheruser)

        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )

        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    @responses.activate
    def test_get_edit_link_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        anotheruser has partial permissions on someuser's data
        anotheruser can only view/edit their own data
        """
        self.client.force_login(self.anotheruser)
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
        submission = self.submissions_submitted_by_unknownuser[0]
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
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        response = self.client.get(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_response = {
            'url': f"{settings.ENKETO_URL}/edit/{submission['_uuid']}",
            'version_uid': self.asset.latest_deployed_version.uid,
        }
        self.assertEqual(response.data, expected_response)

    @responses.activate
    def test_get_edit_link_response_includes_csrf_cookie(self):
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK
        # Just make sure the cookie is present and has a non-empty value
        assert settings.ENKETO_CSRF_COOKIE_NAME in response.cookies
        assert response.cookies[settings.ENKETO_CSRF_COOKIE_NAME].value

    def test_edit_submission_with_digest_credentials(self):
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-alias'),
            args=(self.asset.snapshot().uid,),
        )
        self.client.logout()
        client = DigestClient()
        req = client.post(url)
        # With no credentials provided, Session Auth and Digest Auth should fail.
        # Thus, a 401 should be returned to give the user the opportunity to login.
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        # With correct credentials provided, Session Auth should fail, but
        # Digest Auth should work. But, because 'anotheruser' does not have
        # any permissions on `self.asset` which belongs to 'someuser', a 401
        # should be returned anyway to give the user the opportunity to login
        # with different credentials.
        client.set_authorization('anotheruser', 'anotheruser', 'Digest')
        # Force PartialDigest creation to have match when authenticated is
        # processed.
        self.anotheruser.set_password('anotheruser')
        self.anotheruser.save()

        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        # Give anotheruser permissions to edit submissions.
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)

        # The purpose of this test is to validate that the authentication works.
        # We do not send a valid XML, therefore it should raise a KeyError
        # if authentication (and permissions) works as expected.
        with pytest.raises(KeyError) as e:
            req = client.post(url)

    def test_edit_submission_with_authenticated_session_but_no_digest(self):
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-alias'),
            args=(self.asset.snapshot().uid,),
        )
        self.login_as_other_user('anotheruser', 'anotheruser')
        # Try to edit someuser's submission by anotheruser who has no
        # permissions on someuser's asset.
        req = self.client.post(url)
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        # Give anotheruser permissions to edit submissions.
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)

        # The purpose of this test is to validate that the authentication works.
        # We do not send a valid XML, therefore it should raise a KeyError
        # if authentication (and permissions) works as expected.
        with pytest.raises(KeyError) as e:
            req = self.client.post(url)

    @responses.activate
    def test_get_multiple_edit_links_and_attempt_submit_edits(self):
        """
        Ensure that opening multiple edits allows for all to be submitted
        without the snapshot being recreated and rejecting any of the edits.
        """
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        # open several submissions for editing and store their submission URLs
        # for POSTing to later
        submission_urls = []
        for _ in range(2):
            submission = self.submissions_submitted_by_someuser[0]
            edit_url = reverse(
                self._get_endpoint('submission-enketo-edit'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'pk': submission['_id'],
                },
            )
            self.client.get(edit_url, {'format': 'json'})
            url = reverse(
                self._get_endpoint('assetsnapshot-submission'),
                args=(self.asset.snapshot().uid,),
            )
            submission_urls.append(url)

        # Post all edits to their submission URLs. There is no valid XML being
        # sent, so we expect a KeyError exception if all is good
        for url in submission_urls:
            with pytest.raises(KeyError) as e:
                res = self.client.post(url)

    @responses.activate
    def test_edit_submission_with_different_root_name(self):

        # Mock Enketo response
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        responses.add_callback(
            responses.POST, ee_url,
            callback=enketo_edit_instance_response_with_root_name_validation,
            content_type='application/json',
        )

        # Force random name to create a different root name for already submitted
        # data
        self.asset.content['settings']['name'] = 'different_root_name'
        self.asset.content['settings']['id_string'] = 'different_root_name'
        self.asset.save()  # Create a new version
        self.asset.deploy(backend='mock', active=True)

        xml_submission = self.asset.deployment.get_submission(
            self.submission['_id'], self.asset.owner, SUBMISSION_FORMAT_TYPE_XML
        )

        # Create a snapshot without specifying the root name. The default root
        # name will be the name saved in the settings of the asset version.
        snapshot = self.asset.snapshot(
            version_uid=self.asset.latest_deployed_version_uid,
            submission_uuid=f"uuid:{self.submission['_uuid']}"
        )

        (
            form_root_name,
            submission_root_name,
        ) = get_form_and_submission_tag_names(snapshot.xml, xml_submission)

        # Asset uid should be different from the name stored in settings
        assert self.asset.uid != self.asset.content['settings']['name']
        # submission tag name should equal the asset uid
        assert submission_root_name == self.asset.uid
        # form tag name should equal 'different_root_name'
        # (i.e.: `self.asset.content['settings']['name']`), thus different from
        # submission tag name
        assert form_root_name == self.asset.content['settings']['name']
        assert form_root_name != submission_root_name

        # Enketo will raise the error
        # > "Error trying to parse XML record. Different root nodes"
        # if submission and form root nodes do not match.
        # To avoid this error, the XML of the form is always regenerated with
        # a submission root name on edit.
        # The mock response of Enketo simulates Enketo response and validates
        # that both root nodes match.
        # See `enketo_edit_instance_response_with_root_name_validation()`
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK
        # Validate a new snapshot has been generated for the same criteria
        new_snapshot = self.asset.snapshot(
            version_uid=self.asset.latest_deployed_version_uid,
            submission_uuid=f"uuid:{self.submission['_uuid']}"
        )
        assert new_snapshot.pk != snapshot.pk

    @responses.activate
    def test_edit_submission_with_xml_encoding_declaration(self):
        submission = self.submissions[-1]
        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=[submission['_id']],
        )[0]
        assert submission_xml.startswith('<?xml version="1.0" encoding="utf-8"?>')

        # Get edit endpoint
        edit_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        # Set up a mock Enketo response and attempt the edit request
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        responses.add_callback(
            responses.POST,
            ee_url,
            callback=enketo_edit_instance_response_with_uuid_validation,
            content_type='application/json',
        )
        response = self.client.get(edit_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    @responses.activate
    def test_edit_submission_with_xml_missing_uuids(self):
        # Make a new submission without UUIDs
        submission = copy.deepcopy(self.submissions[-1])
        submission['_id'] += 1

        del submission['meta/instanceID']
        del submission['_uuid']

        submission['find_this'] = 'hello!'
        # The form UUID is already omitted by these tests, but fail if that
        # changes in the future
        assert 'formhub/uuid' not in submission.keys()

        # Attempt to mock the submission without UUIDs
        with self.assertRaises(InstanceIdMissingError) as ex:
            self.asset.deployment.mock_submissions([submission], create_uuids=False)

        # Rejecting the submission because it does not have an instance ID
        self.assertEqual(str(ex.exception), 'Could not determine the instance ID')

        # Test the edit flow with a submission that has a UUID
        submission['meta/instanceID'] = 'uuid:9710c729-00a5-41f1-b740-8dd618bb4a49'
        self.asset.deployment.mock_submissions([submission], create_uuids=False)

        # Find and verify the new submission
        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            query={'find_this': 'hello!'},
        )[0]
        submission_json = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_JSON,
            query={'find_this': 'hello!'},
        )[0]

        submission_xml_root = fromstring_preserve_root_xmlns(submission_xml)
        assert submission_json['_id'] == submission['_id']
        assert submission_xml_root.find('./find_this').text == 'hello!'
        assert (
            submission_xml_root.find('./meta/instanceID').text ==   # noqa: W504
            'uuid:9710c729-00a5-41f1-b740-8dd618bb4a49'
        )
        assert submission_xml_root.find('./formhub/uuid') is None

        # Get edit endpoint
        edit_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission_json['_id'],
            },
        )

        # Set up a mock Enketo response and attempt the edit request
        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        responses.add_callback(
            responses.POST,
            ee_url,
            callback=enketo_edit_instance_response_with_uuid_validation,
            content_type='application/json',
        )
        response = self.client.get(edit_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

    @responses.activate
    def test_get_edit_link_submission_with_latest_asset_deployment(self):
        """
        Check that the submission edit is using the asset version associated
        with the latest **deployed** version.
        """
        original_versions_count = self.asset.asset_versions.count()
        original_deployed_versions_count = self.asset.deployed_versions.count()
        original_deployed_version_uid = self.asset.latest_deployed_version.uid

        ee_url = (
            f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        )
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        # make a change to the asset content but don't redeploy yet
        self.asset.content['survey'].append(
            {
                'type': 'note',
                'name': 'n',
                'label': ['A new note'],
            }
        )

        self.asset.save()
        assert self.asset.asset_versions.count() == original_versions_count + 1
        assert (
            self.asset.deployed_versions.count()
            == original_deployed_versions_count
        )

        # ensure that the latest deployed version is used for the edit, even if
        # there's a new asset version
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK
        expected_response = {
            'url': f"{settings.ENKETO_URL}/edit/{self.submission['_uuid']}",
            'version_uid': original_deployed_version_uid,
        }
        assert response.data == expected_response

        # redeploy the asset to create a new deployment version
        self.asset.deploy(active=True)
        self.asset.save()
        assert self.asset.asset_versions.count() == original_versions_count + 2
        assert (
            self.asset.deployed_versions.count()
            == original_deployed_versions_count + 1
        )

        # ensure that the newly deployed version is used for editing
        response = self.client.get(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK
        expected_response = {
            'url': f"{settings.ENKETO_URL}/edit/{self.submission['_uuid']}",
            'version_uid': self.asset.latest_deployed_version.uid,
        }
        assert response.data == expected_response

    def test_edit_submission_snapshot_missing(self):
        # use non-existent snapshot id
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-alias'),
            args=('12345',),
        )
        client = DigestClient()
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_submission_snapshot_missing_unauthenticated(self):
        # use non-existent snapshot id
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-alias'),
            args=('12345',),
        )
        self.client.logout()
        client = DigestClient()
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_submission_with_partial_perms(self):
        # Use Digest authentication; testing SessionAuth is not required.
        # The purpose of this test is to validate partial permissions.
        submission = self.submissions_submitted_by_anotheruser[0]
        instance_xml = self.asset.deployment.get_submission(
            submission['_id'], self.asset.owner, format_type='xml'
        )
        xml_parsed = fromstring_preserve_root_xmlns(instance_xml)
        edit_submission_xml(
            xml_parsed, 'meta/deprecatedID', submission['meta/instanceID']
        )
        edit_submission_xml(xml_parsed, 'meta/instanceID', 'foo')
        edited_submission = xml_tostring(xml_parsed)

        url = reverse(
            self._get_endpoint('assetsnapshot-submission-alias'),
            args=(self.asset.snapshot().uid,),
        )
        self.client.logout()
        client = DigestClient()
        req = client.post(url)  # Retrieve www-challenge

        client.set_authorization('anotheruser', 'anotheruser', 'Digest')
        self.anotheruser.set_password('anotheruser')
        self.anotheruser.save()
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={
                PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
            },
        )
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        # Give anotheruser permissions to edit submissions someuser's data.
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={
                PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'someuser'}]
            },
        )

        data = {'xml_submission_file': ContentFile(edited_submission)}
        response = client.post(url, data)
        # Receive a 403 because we are trying to edit anotheruser's data
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Give anotheruser permissions to edit submissions their data.
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={
                PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
            },
        )

        data = {'xml_submission_file': ContentFile(edited_submission)}
        response = client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED


class SubmissionViewApiTests(SubmissionViewTestCaseMixin, BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.submission = self.submissions_submitted_by_someuser[0]
        self.submission_view_link_url = reverse(
            self._get_endpoint('submission-enketo-view'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_view_redirect_url = (
            self.submission_view_link_url.replace(
                '/enketo/view/', '/enketo/redirect/view/'
            )
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


class SubmissionDuplicateBaseApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self.asset.advanced_features = {
            'translation': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            },
            'transcript': {
                'values': ['q1'],
            }
        }
        current_time = datetime.now(tz=ZoneInfo('UTC')).isoformat('T', 'milliseconds')
        self._add_submissions(other_fields={'start': current_time, 'end': current_time})

        self.submission = self.submissions_submitted_by_someuser[0]
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

        expected_next_id = max(sub['_id'] for sub in self.submissions) + 1
        assert submission['_id'] != duplicate_submission['_id']
        assert duplicate_submission['_id'] == expected_next_id

        assert submission['meta/instanceID'] != duplicate_submission['meta/instanceID']
        assert submission['start'] != duplicate_submission['start']
        assert submission['end'] != duplicate_submission['end']


class SubmissionDuplicateWithXMLNamespaceApiTests(SubmissionDuplicateBaseApiTests):

    def setUp(self):
        with mock.patch(
            'kpi.deployment_backends.mock_backend.dict2xform'
        ) as mock_dict2xform:
            mock_dict2xform.side_effect = dict2xform_with_namespace
            super().setUp()

    def test_duplicate_submission_with_xml_namespace(self):

        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=[self.submission['_id']],
        )[0]
        assert 'xmlns="http://opendatakit.org/submissions"' in submission_xml
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED
        self._check_duplicate(response)


class SubmissionDuplicateApiTests(SubmissionDuplicateBaseApiTests):

    def setUp(self):
        super().setUp()

    def test_duplicate_submission_as_owner_allowed(self):
        """
        someuser is the owner of the project.
        someuser is allowed to duplicate their own data
        """
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED
        self._check_duplicate(response)

    def test_duplicate_submission_with_xml_encoding(self):
        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=[self.submission['_id']],
        )[0]
        assert submission_xml.startswith('<?xml version="1.0" encoding="utf-8"?>')
        self.test_duplicate_submission_as_owner_allowed()

    def test_duplicate_submission_without_xml_encoding(self):
        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=[self.submission['_id']],
        )[0]
        assert submission_xml.startswith('<?xml version="1.0" encoding="utf-8"?>')
        Instance.objects.filter(pk=self.submission['_id']).update(
            xml=submission_xml.replace('<?xml version="1.0" encoding="utf-8"?>', '')
        )
        self.test_duplicate_submission_as_owner_allowed()

    def test_duplicate_submission_as_anotheruser_not_allowed(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data and someuser's data existence
        should not be revealed.
        """
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_submission_as_anotheruser_with_partial_perms(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser has partial change submissions permissions.
        They can edit/duplicate their own data only.
        """
        self.client.force_login(self.anotheruser)

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
        submission = self.submissions_submitted_by_unknownuser[0]
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
        submission = self.submissions_submitted_by_anotheruser[0]
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

    def test_duplicate_submission_with_extras(self):
        dummy_extra = {
            'q1': {
                'transcript': {
                    'value': 'dummy transcription',
                    'languageCode': 'en',
                },
                'translation': {
                    'tx1': {
                        'value': 'dummy translation',
                        'languageCode': 'xx',
                    }
                },
            },
            'submission': self.submission['_uuid']
        }
        self.asset.update_submission_extra(dummy_extra)
        response = self.client.post(self.submission_url, {'format': 'json'})
        duplicated_submission = response.data
        duplicated_extra = self.asset.submission_extras.filter(
            submission_uuid=duplicated_submission['_uuid']
        ).first()
        assert (
            duplicated_extra.content['q1']['translation']['tx1']['value']
            == dummy_extra['q1']['translation']['tx1']['value']
        )
        assert (
            duplicated_extra.content['q1']['transcript']['value']
            == dummy_extra['q1']['transcript']['value']
        )


class BulkUpdateSubmissionsApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.submission_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
            },
        )

        submissions = self.submissions_submitted_by_someuser
        self.updated_submission_data = {
            'submission_ids': [rs['_id'] for rs in submissions],
            'data': {
                'q1': 'Updated value',
                'q_new': 'A new question and value'
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

    @pytest.mark.skip(
        reason=(
            'Useless with the current implementation of'
            ' MockDeploymentBackend.duplicate_submission()'
        )
    )
    def test_bulk_update_submissions_with_xml_encoding(self):
        submission = self.submissions[
            self.updated_submission_data['submission_ids'][-1]
        ]
        submission_xml = self.asset.deployment.get_submissions(
            user=self.asset.owner,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=[submission['_id']],
        )[0]
        assert submission_xml.startswith('<?xml version="1.0" encoding="utf-8"?>')
        self.test_bulk_update_submissions_allowed_as_owner()

    @pytest.mark.skip(
        reason=(
            'Useless with the current implementation of'
            ' MockDeploymentBackend.duplicate_submission()'
        )
    )
    def test_bulk_update_submissions_with_xml_namespace(self):
        with mock.patch(
            'kpi.deployment_backends.mock_backend.dict2xform'
        ) as mock_dict2xform:
            mock_dict2xform.side_effect = dict2xform_with_namespace
            submission = self.submissions[
                self.updated_submission_data['submission_ids'][-1]
            ]
            submission_xml = self.asset.deployment.get_submissions(
                user=self.asset.owner,
                format_type=SUBMISSION_FORMAT_TYPE_XML,
                submission_ids=[submission['_id']],
            )[0]
            assert (
                'xmlns="http://opendatakit.org/submissions"' in submission_xml
            )
            self.test_bulk_update_submissions_allowed_as_owner()

    def test_cannot_bulk_update_submissions_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser cannot access someuser's data.
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)

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
        submissions = self.submissions_submitted_by_anotheruser
        self.updated_submission_data['submission_ids'] = [
            rs['_id'] for rs in submissions
        ]
        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self._check_bulk_update(response)


class SubmissionValidationStatusApiTests(
    SubmissionValidationStatusTestCaseMixin, BaseSubmissionTestCase
):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.submission = self.submissions_submitted_by_someuser[0]
        self.validation_status_url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

    def test_retrieve_status_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve status of their own submissions
        """
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_cannot_retrieve_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data.
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
        response = self.client.get(self.validation_status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

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
        self._update_status('someuser')
        self._delete_status()

    def test_cannot_delete_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's data, therefore cannot delete
        validation status.
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self._update_status('someuser')

    def test_cannot_edit_status_of_not_shared_submission_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is not shared with anyone.
        anotheruser has no access to someuser's submissions and therefore, cannot
        validate them.
        someuser's data existence should not be revealed.
        """
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate someuser's data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        data = {
            'validation_status.uid': 'validation_status_not_approved'
        }

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.patch(url, data=data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try second submission submitted by anotheruser
        submission = self.submissions_submitted_by_anotheruser[0]
        url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.patch(url, data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Ensure update worked.
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['by_whom'], 'anotheruser')
        self.assertEqual(response.data['uid'], data['validation_status.uid'])


class SubmissionValidationStatusesApiTests(
    SubmissionValidationStatusTestCaseMixin, BaseSubmissionTestCase
):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.validation_statuses_url = reverse(
            self._get_endpoint('submission-validation-statuses'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )

        self._validate_statuses(empty=True)
        self._update_statuses(status_uid='validation_status_not_approved')

    def test_all_validation_statuses_applied(self):
        self._validate_statuses(
            uid='validation_status_not_approved', username='someuser'
        )

    def test_delete_all_statuses_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can bulk delete the status of all their submissions.
        """
        response = self._delete_statuses()
        count = self._deployment.calculated_submission_count(self.someuser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        assert response.data == expected_response

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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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
        self.client.force_login(self.anotheruser)
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

    def test_edit_all_sub_validation_statuses_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser can only validate their own data.
        `confirm=true` must be sent when the request alters all their submissions
        at once.
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [
                {'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate their own data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'confirm': True,
            }
        }

        # Update all submissions anotheruser is allowed to edit
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count = self._deployment.calculated_submission_count(self.anotheruser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Get all submissions and ensure only the ones that anotheruser is
        # allowed to edit have been modified
        self.client.logout()
        self.client.login(username='someuser', password='someuser')
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

    def test_edit_some_sub_validation_statuses_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser can only validate their own data.
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {
            PERM_VALIDATE_SUBMISSIONS: [
                {'_submitted_by': 'anotheruser'}]
        }
        # Allow anotheruser to validate their own data
        self.asset.assign_perm(self.anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)

        submissions = self.submissions_submitted_by_someuser
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': [rs['_id'] for rs in submissions],
            }
        }

        # Try first submission submitted by unknown
        response = self.client.patch(self.validation_statuses_url,
                                     data=data,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try 2nd submission submitted by anotheruser
        submissions = self.submissions_submitted_by_anotheruser
        data['payload']['submission_ids'] = [rs['_id'] for rs in submissions]
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count = self._deployment.calculated_submission_count(
            self.anotheruser, submission_ids=data['payload']['submission_ids'])
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Get all submissions and ensure only the ones that anotheruser is
        # allowed to edit have been modified
        self.client.logout()
        self.client.login(username='someuser', password='someuser')
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
                'parent_lookup_asset': a.uid,
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
