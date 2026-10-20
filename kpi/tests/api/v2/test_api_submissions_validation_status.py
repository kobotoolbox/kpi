import uuid

from django.urls import reverse
from rest_framework import status

from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    add_uuid_prefix,
    remove_uuid_prefix,
)
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.tests.api.v2.test_api_submissions import BaseSubmissionTestCase
from kpi.tests.utils.mixins import (
    SubmissionValidationStatusTestCaseMixin,
)


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
                'uid_asset': self.asset.uid,
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
        data = {'validation_status.uid': 'validation_status_not_approved'}
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
        partial_perms = {PERM_VALIDATE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}
        # Allow anotheruser to validate someuser's data
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        data = {'validation_status.uid': 'validation_status_not_approved'}

        # Try first submission submitted by unknown
        submission = self.submissions_submitted_by_unknownuser[0]
        url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={
                'uid_asset': self.asset.uid,
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
                'uid_asset': self.asset.uid,
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
            kwargs={'uid_asset': self.asset.uid, 'format': 'json'},
        )
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'uid_asset': self.asset.uid, 'format': 'json'},
        )

        self._validate_statuses(empty=True)
        self._update_statuses(status_uid='validation_status_not_approved')

    def test_all_validation_statuses_applied(self):
        self._validate_statuses(
            uid='validation_status_not_approved', username='someuser'
        )

    def test_cannot_set_validation_statuses_of_another_project(self):
        """
        someuser must not be able to set the validation status of another
        project's submissions by passing foreign ids to their own project
        endpoint. The whole batch is rejected (400).
        """
        foreign_ids = self._create_other_project_with_submissions()
        assert len(foreign_ids) == 2

        self.client.force_login(self.someuser)
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': foreign_ids,
            }
        }
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # The foreign submissions must not have been updated
        for instance in Instance.objects.filter(id__in=foreign_ids):
            assert instance.validation_status in ({}, None)

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
        submission_id = self.submissions_submitted_by_someuser[0]['_id']
        data = {
            'payload': {
                'validation_status.uid': None,
                'submission_ids': [submission_id],
            }
        }
        response = self.client.delete(
            self.validation_statuses_url, data=data, format='json'
        )
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
        response = self.client.delete(
            self.validation_statuses_url, data=data, format='json'
        )

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
        response = self.client.delete(
            self.validation_statuses_url, data=data, format='json'
        )

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
        response = self.client.delete(
            self.validation_statuses_url, data=data, format='json'
        )

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
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        # `confirm` must be sent within payload (when all submissions are
        # modified). Otherwise, a ValidationError is raised
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        data['payload']['confirm'] = True
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
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
        submission_id = self.submissions_submitted_by_someuser[0]['_id']
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': [submission_id],
            }
        }
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
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
                    validation_status['uid'], data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(
                    validation_status['uid'], data['payload']['validation_status.uid']
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
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
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
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        count = self._deployment.calculated_submission_count(self.anotheruser)
        expected_response = {'detail': f'{count} submissions have been updated'}
        self.assertEqual(response.data, expected_response)

        # Ensure update worked.
        response = self.client.get(self.submission_list_url)
        for submission in response.data['results']:
            validation_status = submission['_validation_status']
            self.assertEqual(validation_status['by_whom'], 'anotheruser')
            self.assertEqual(
                validation_status['uid'], data['payload']['validation_status.uid']
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
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
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
        partial_perms = {PERM_VALIDATE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}
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
                    validation_status['uid'], data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(validation_status['by_whom'], 'anotheruser')
                self.assertNotEqual(
                    validation_status['uid'], data['payload']['validation_status.uid']
                )

    def test_edit_some_sub_validation_statuses_with_partial_perms_as_anotheruser(self):
        """
        someuser is the owner of the project.
        The project is partially shared with anotheruser.
        anotheruser can only validate their own data.
        """
        self.client.force_login(self.anotheruser)
        partial_perms = {PERM_VALIDATE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}
        # Allow anotheruser to validate their own data
        self.asset.assign_perm(
            self.anotheruser, PERM_PARTIAL_SUBMISSIONS, partial_perms=partial_perms
        )

        submissions = self.submissions_submitted_by_someuser
        data = {
            'payload': {
                'validation_status.uid': 'validation_status_approved',
                'submission_ids': [rs['_id'] for rs in submissions],
            }
        }

        # Try first submission submitted by unknown
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try 2nd submission submitted by anotheruser
        submissions = self.submissions_submitted_by_anotheruser
        data['payload']['submission_ids'] = [rs['_id'] for rs in submissions]
        response = self.client.patch(
            self.validation_statuses_url, data=data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        count = self._deployment.calculated_submission_count(
            self.anotheruser, submission_ids=data['payload']['submission_ids']
        )
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
                    validation_status['uid'], data['payload']['validation_status.uid']
                )
            else:
                self.assertNotEqual(validation_status['by_whom'], 'anotheruser')
                self.assertNotEqual(
                    validation_status['uid'], data['payload']['validation_status.uid']
                )

        # TODO Test with `query` when Mockbackend support Mongo queries

    def test_submitted_by_persists_when_validation_status_updated(self):
        """
        Test that the `_submitted_by` remains correct when:

        1. share asset with anotheruser
        2. have anotheruser submit a record
        3. delete anotheruser
        4. update submission validation status
        5. update validation status via bulk update
        """
        # 1. Share the project with anotheruser
        self.asset.assign_perm(self.anotheruser, PERM_ADD_SUBMISSIONS)

        # 2. Make anotheruser submit data to the shared project
        submission_uuid = str(uuid.uuid4())
        version_uid = self.asset.latest_deployed_version.uid
        submission = {
            '__version__': version_uid,
            'meta/instanceID': add_uuid_prefix(submission_uuid),
            '_uuid': submission_uuid,
            '_submitted_by': self.anotheruser.username,
            'q1': 'initial value for validation test',
        }
        self.asset.deployment.mock_submissions([submission])
        root_uuid = remove_uuid_prefix(submission['_uuid'])
        instance = Instance.objects.get(root_uuid=root_uuid)

        # Simulate old submission that does not have submitted_by stored
        ParsedInstance.objects.filter(instance=instance).update(submitted_by=None)
        deleted_username = self.anotheruser.username

        # 3. Delete the submitting user
        self.anotheruser.delete()

        # Ensure submission still shows correct _submitted_by
        detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={'uid_asset': self.asset.uid, 'pk': instance.pk},
        )
        resp = self.client.get(detail_url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['_submitted_by'] == deleted_username

        # 4. Update validation status for the single submission (owner does update)
        validation_url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={'uid_asset': self.asset.uid, 'pk': instance.pk},
        )
        single_update = {'validation_status.uid': 'validation_status_approved'}
        resp = self.client.patch(validation_url, data=single_update)
        assert resp.status_code == status.HTTP_200_OK

        # Ensure detail still has original _submitted_by
        resp = self.client.get(detail_url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['_submitted_by'] == deleted_username
        assert resp.data['_validation_status']['uid'] == 'validation_status_approved'
        assert resp.data['_validation_status']['by_whom'] == self.someuser.username

        # Ensure a ProjectHistoryLog was created with correct submitted_by
        ph_single = (
            ProjectHistoryLog.objects.filter(
                metadata__submission__root_uuid=instance.root_uuid,
            )
            .order_by('-date_created')
            .first()
        )
        assert ph_single.metadata['submission']['submitted_by'] == deleted_username

        # 5. Bulk update the validation statuses for that submission id
        bulk_payload = {
            'payload': {
                'validation_status.uid': 'validation_status_not_approved',
                'submission_ids': [instance.pk],
            }
        }
        resp = self.client.patch(
            self.validation_statuses_url, data=bulk_payload, format='json'
        )
        assert resp.status_code == status.HTTP_200_OK

        # Ensure detail still has original _submitted_by
        resp = self.client.get(detail_url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['_submitted_by'] == deleted_username
        assert (
            resp.data['_validation_status']['uid'] == 'validation_status_not_approved'
        )

        # Ensure a ProjectHistoryLog was created with correct submitted_by
        ph_bulk = (
            ProjectHistoryLog.objects.filter(
                metadata__submission__root_uuid=instance.root_uuid,
            )
            .order_by('-date_created')
            .first()
        )
        assert ph_bulk.metadata['submission']['submitted_by'] == deleted_username
