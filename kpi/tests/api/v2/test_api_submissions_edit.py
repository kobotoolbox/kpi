import copy
import os
import random
import string
import uuid
from datetime import datetime
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
import responses
from constance.test import override_config
from ddt import data, ddt, unpack
from django.conf import settings
from django.core.files.base import ContentFile
from django.urls import reverse
from django_digest.test import Client as DigestClient
from rest_framework import status

from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.openrosa.apps.logger.exceptions import InstanceIdMissingError
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    add_uuid_prefix,
    remove_uuid_prefix,
)
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kobo.apps.openrosa.libs.utils.common_tags import (
    META_FORM_VERSIONS,
)
from kobo.apps.openrosa.libs.utils.logger_tools import dict2xform
from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.models import SubmissionSupplement
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
)
from kpi.models import Asset, AssetSnapshot
from kpi.tests.api.v2.test_api_submissions import BaseSubmissionTestCase
from kpi.tests.utils.mixins import (
    SubmissionEditTestCaseMixin,
)
from kpi.tests.utils.mock import (
    enketo_edit_instance_response,
    enketo_edit_instance_response_with_root_name_validation,
    enketo_edit_instance_response_with_uuid_validation,
)
from kpi.tests.utils.xml import get_form_and_submission_tag_names
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


def dict2xform_with_namespace(submission: dict, xform_id_string: str) -> str:
    xml_string = dict2xform(submission, xform_id_string)
    xml_root = fromstring_preserve_root_xmlns(xml_string)
    xml_root.set('xmlns', 'http://opendatakit.org/submissions')
    return xml_tostring(xml_root)


@ddt
class SubmissionEditApiTests(SubmissionEditTestCaseMixin, BaseSubmissionTestCase):
    """
    Tests for editing submissions.

    WARNING: Tests in this class must work in v1 as well, or else be added to the
    skipped tests in kpi/tests/api/v1/test_api_submissions.py
    """

    def setUp(self):
        super().setUp()

        self._add_submissions()
        self.submission = self.submissions_submitted_by_someuser[0]

        # Several URLs share the same viewname 'submission-enketo-edit' because
        # of aliases. Django returns the last match - which is "/enketo/edit/"
        self.submission_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_url_legacy = reverse(
            self._get_endpoint('submission-enketo-edit-legacy'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_redirect_url = reverse(
            self._get_endpoint('submission-enketo-edit-redirect'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

    @responses.activate
    def test_get_legacy_edit_link_submission_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link through old API endpoint
        """
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
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
    def test_get_edit_link_with_duplicates_in_content(self):
        self.asset.content = {
            'survey': [
                {'type': 'text', 'label': 'fixture q1', 'name': 'q1', 'kuid': 'abc'},
                {
                    'type': 'text',
                    'label': 'fixture q1 duplicate',
                    'name': 'q1',
                    'kuid': 'def',
                },
            ]
        }

        def force_autoname_no_error(content, **kwargs):
            # simulate old-style autonaming
            content['survey'] = [
                {
                    'type': 'text',
                    'label': ['fixture q1'],
                    'name': 'q1',
                    'kuid': 'abc',
                    '$autoname': 'q1',
                },
                {
                    'type': 'text',
                    'label': ['fixture q1 duplicate'],
                    'name': 'q1',
                    'kuid': 'def',
                    '$autoname': 'q1_001',
                    '$given_name': 'q1',
                },
                {
                    'name': '__version__',
                    'calculation': "'vttkbu4G8hbjC8ST3s8B8S'",
                    'type': 'calculate',
                    '$autoname': '__version__',
                },
            ]

        with mock.patch.object(
            self.asset, '_autoname', side_effect=force_autoname_no_error
        ):
            self.asset.save()
            self.asset.deploy()
        uuid_ = uuid.uuid4()
        submission = {
            'q1': ''.join(random.choice(string.ascii_letters) for letter in range(10)),
            'q1_001': ''.join(
                random.choice(string.ascii_letters) for letter in range(10)
            ),
            'meta/instanceID': f'uuid:{uuid_}',
            '_uuid': str(uuid_),
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission])
        self.submission = submission
        self._get_edit_link()

        # `_get_edit_link()` only proves the endpoint answered 200; the XML the
        # snapshot exposes to Enketo is what actually matters here
        snapshot = AssetSnapshot.objects.filter(asset=self.asset).latest('date_created')
        assert snapshot.details['status'] == 'success'
        assert 'q1_001' in snapshot.xml

    @responses.activate
    def test_get_edit_submission_redirect_as_owner(self):
        """
        someuser is the owner of the project.
        someuser can retrieve enketo edit link
        """
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
            callback=enketo_edit_instance_response,
            content_type='application/json',
        )

        response = self.client.get(self.submission_redirect_url, {'format': 'json'})
        assert response.status_code == status.HTTP_302_FOUND
        assert response.url == f"{settings.ENKETO_URL}/edit/{self.submission['_uuid']}"

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

        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'

        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
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
        partial_perms = {PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}

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
                'uid_asset': self.asset.uid,
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
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )

        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
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
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
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
            self._get_endpoint('assetsnapshot-submission-openrosa'),
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
        with pytest.raises(KeyError):
            req = client.post(url)

    def test_edit_submission_with_authenticated_session_but_no_digest(self):
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-openrosa'),
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
        with pytest.raises(KeyError):
            req = self.client.post(url)

    @responses.activate
    def test_get_multiple_edit_links_and_attempt_submit_edits(self):
        """
        Ensure that opening multiple edits allows for all to be submitted
        without the snapshot being recreated and rejecting any of the edits.
        """
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        # Mock Enketo response
        responses.add_callback(
            responses.POST,
            ee_url,
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
                    'uid_asset': self.asset.uid,
                    'pk': submission['_id'],
                },
            )
            self.client.get(edit_url, {'format': 'json'})
            url = reverse(
                self._get_endpoint('assetsnapshot-submission-openrosa'),
                args=(self.asset.snapshot().uid,),
            )
            submission_urls.append(url)

        # Post all edits to their submission URLs. There is no valid XML being
        # sent, so we expect a KeyError exception if all is good
        for url in submission_urls:
            with pytest.raises(KeyError):
                self.client.post(url)

    @responses.activate
    def test_edit_submission_with_different_root_name(self):

        # Mock Enketo response
        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        responses.add_callback(
            responses.POST,
            ee_url,
            callback=enketo_edit_instance_response_with_root_name_validation,
            content_type='application/json',
        )

        # Force random name to create a different root name for already submitted
        # data
        self.asset.content['settings']['name'] = 'different_root_name'
        self.asset.content['settings']['id_string'] = 'different_root_name'
        self.asset.save()  # Create a new version
        self.asset.deploy(backend='mock', active=True)

        # Retrieve the submission from MongoDB because self.submission does not match
        # the data returned by the API (e.g., it lacks fields like `meta/rootUuid`).
        json_submission = self.asset.deployment.get_submission(
            self.submission['_id'], self.asset.owner
        )

        xml_submission = self.asset.deployment.get_submission(
            self.submission['_id'], self.asset.owner, SUBMISSION_FORMAT_TYPE_XML
        )

        submission_root_uuid = remove_uuid_prefix(json_submission['meta/rootUuid'])

        # Create a snapshot without specifying the root name. The default root
        # name will be the name saved in the settings of the asset version.
        snapshot = self.asset.snapshot(
            version_uid=self.asset.latest_deployed_version_uid,
            submission_uuid=submission_root_uuid,
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
            submission_uuid=submission_root_uuid,
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
                'uid_asset': self.asset.uid,
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
            submission_xml_root.find('./meta/instanceID').text  # noqa: W504
            == 'uuid:9710c729-00a5-41f1-b740-8dd618bb4a49'
        )
        assert submission_xml_root.find('./formhub/uuid') is None

        # Get edit endpoint
        edit_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission_json['_id'],
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
    def test_get_edit_link_submission_with_latest_asset_deployment(self):
        """
        Check that the submission edit is using the asset version associated
        with the latest **deployed** version.
        """
        original_versions_count = self.asset.asset_versions.count()
        original_deployed_versions_count = self.asset.deployed_versions.count()
        original_deployed_version_uid = self.asset.latest_deployed_version.uid

        ee_url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
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
        assert self.asset.deployed_versions.count() == original_deployed_versions_count

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
        assert self.asset.asset_versions.count() == original_versions_count + 1
        assert (
            self.asset.deployed_versions.count() == original_deployed_versions_count + 1
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
            self._get_endpoint('assetsnapshot-submission-openrosa'),
            args=('12345',),
        )
        client = DigestClient()
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_404_NOT_FOUND)

    def test_edit_submission_snapshot_missing_unauthenticated(self):
        # use non-existent snapshot id
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-openrosa'),
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
        submission_json = self.asset.deployment.get_submission(
            submission['_id'], self.asset.owner, format_type='json'
        )
        instance_xml = self.asset.deployment.get_submission(
            submission['_id'], self.asset.owner, format_type='xml'
        )
        xml_parsed = fromstring_preserve_root_xmlns(instance_xml)
        edit_submission_xml(
            xml_parsed,
            self.asset.deployment.SUBMISSION_DEPRECATED_UUID_XPATH,
            submission_json['meta/instanceID'],
        )
        edit_submission_xml(
            xml_parsed,
            self.asset.deployment.SUBMISSION_ROOT_UUID_XPATH,
            submission_json['meta/rootUuid'],
        )
        edit_submission_xml(
            xml_parsed,
            self.asset.deployment.SUBMISSION_CURRENT_UUID_XPATH,
            'foo',
        )
        edited_submission = xml_tostring(xml_parsed)

        url = reverse(
            self._get_endpoint('assetsnapshot-submission-openrosa'),
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
            partial_perms={PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]},
        )
        req = client.post(url)
        self.assertEqual(req.status_code, status.HTTP_401_UNAUTHORIZED)

        # Give anotheruser permissions to edit submissions someuser's data.
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'someuser'}]},
        )

        data = {'xml_submission_file': ContentFile(edited_submission)}
        response = client.post(url, data)
        # Receive a 403 because we are trying to edit anotheruser's data
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Give anotheruser permissions to edit submissions their data.
        self.asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]},
        )

        data = {'xml_submission_file': ContentFile(edited_submission)}
        response = client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED

    def test_edit_submission_with_large_uploads(self):
        # Create a project with two optional media questions: one audio and one file
        asset = Asset.objects.create(
            content={
                'survey': [
                    {'type': 'audio', 'label': 'q1', 'required': 'false'},
                    {'type': 'file', 'label': 'q2', 'required': 'false'},
                ]
            },
            owner=self.someuser,
            asset_type='survey',
        )
        asset.deploy(backend='mock', active=True)
        asset.save()

        submission_uuid = str(uuid.uuid4())
        version_uid = asset.latest_deployed_version.uid

        # Simulate one initial submission (without actual media files yet)
        submission = {
            '__version__': version_uid,
            'meta/instanceID': add_uuid_prefix(submission_uuid),
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_submitted_by': 'someuser',
        }
        asset.deployment.mock_submissions([submission])

        # Simulate editing the submission:
        # - fetch the original XML
        # - generate a new snapshot
        # - inject rootUuid and deprecatedID in XML
        instance = Instance.objects.get(root_uuid=remove_uuid_prefix(submission_uuid))
        submission_xml = instance.xml
        submission_json = asset.deployment.get_submission(
            instance.pk, asset.owner, format_type='json'
        )
        xml_parsed = fromstring_preserve_root_xmlns(submission_xml)
        xml_root_node_name = xml_parsed.tag

        snapshot = asset.snapshot(
            regenerate=True,
            version_uid=version_uid,
            submission_uuid=remove_uuid_prefix(submission_json['meta/rootUuid']),
            root_node_name=xml_root_node_name,
        )

        edit_submission_xml(
            xml_parsed, 'meta/deprecatedID', submission_json['meta/instanceID']
        )
        edit_submission_xml(
            xml_parsed, 'meta/rootUuid', submission_json['meta/rootUuid']
        )
        new_submission_uuid = str(uuid.uuid4())
        edit_submission_xml(xml_parsed, 'meta/instanceID', new_submission_uuid)
        edited_submission = xml_tostring(xml_parsed)

        # Submit the edited XML in multiple POSTs, simulating Enketo behavior.
        # Enketo splits large submissions into chunks (max 10 MB per request).
        # Here we simulate that by sending one attachment per request.
        url = reverse(
            self._get_endpoint('assetsnapshot-submission-openrosa'),
            args=(snapshot.uid,),
        )

        attachments = [
            'audio_conversion_test_clip.3gp',
            'audio_conversion_test_image.jpg',
        ]

        for idx, attachment in enumerate(attachments):
            attachment_path = os.path.join(
                settings.BASE_DIR, 'kpi', 'fixtures', 'attachments', attachment
            )
            with open(attachment_path, 'rb') as f:
                data = {'xml_submission_file': ContentFile(edited_submission)}
                files = {attachment: f.read()}
                response = self.client.post(url, data, files=files)

                # The first POST creates the edited submission (201) with one
                # attachment, the second attaches the file to the submission (202).
                assert response.status_code == (
                    status.HTTP_201_CREATED if idx == 0 else status.HTTP_202_ACCEPTED
                )

    def test_edit_submission_without_root_uuid(self):
        # Old submissions may have `root_uuid = None` because this is a relatively new
        # feature. Only recent submissions have their `root_uuid` set at the time of
        # saving.
        # For legacy data, we must fall back to `uuid` when `root_uuid` is null,
        # until long-running migration 0005 has completed and populated missing values.

        root_uuid = remove_uuid_prefix(self.submission['_uuid'])

        instance = Instance.objects.get(root_uuid=root_uuid)

        # Simulate a legacy submission by clearing the root_uuid
        Instance.objects.filter(pk=instance.pk).update(root_uuid=None)

        self._simulate_edit_submission(instance)

    def test_edit_submission_twice(self):
        # Ensure that double edit still work if we use `root_uuid` to identify
        # the edited submission
        self.test_edit_submission_without_root_uuid()
        root_uuid = remove_uuid_prefix(self.submission['_uuid'])
        instance = Instance.objects.get(root_uuid=root_uuid)
        assert 'deprecatedID' in instance.xml
        self._simulate_edit_submission(instance)

    def test_edit_submission_with_newer_version_records_form_versions(self):
        """
        A submission collected with one version and edited while a newer one is
        deployed must end up tagged with both, oldest first.
        """

        original_version_uid = self.asset.latest_deployed_version.uid
        instance = Instance.objects.get(
            root_uuid=remove_uuid_prefix(self.submission['_uuid'])
        )
        # A submission that never spanned two versions carries no lineage
        assert META_FORM_VERSIONS not in self._get_submission(instance)

        self.asset.content['survey'].append(
            {'type': 'note', 'name': 'n', 'label': ['A new note']}
        )
        self.asset.save()
        self.asset.deploy(active=True)
        self.asset.save()
        new_version_uid = self.asset.latest_deployed_version.uid
        assert new_version_uid != original_version_uid

        self._simulate_edit_submission(instance)

        assert self._get_submission(instance)[META_FORM_VERSIONS] == (
            f'{original_version_uid} {new_version_uid}'
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(USAGE_LIMIT_ENFORCEMENT=True)
    @mock.patch(
        'kobo.apps.openrosa.libs.utils.logger_tools.ServiceUsageCalculator.get_usage_balances'  # noqa: E501
    )
    def test_edit_submission_ignores_usage_limit_enforcement(self, mock_usage):
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'exceeded': True,
            },
            UsageType.SUBMISSION: {
                'exceeded': True,
            },
        }
        mock_usage.return_value = mock_balances
        root_uuid = remove_uuid_prefix(self.submission['_uuid'])
        instance = Instance.objects.get(root_uuid=root_uuid)
        self._simulate_edit_submission(instance)

    def test_submitted_by_persist_after_edit(self):
        root_uuid = remove_uuid_prefix(self.submission['_uuid'])
        instance = Instance.objects.get(root_uuid=root_uuid)
        original_submitted_by = instance.parsed_instance.submitted_by

        # Edit the submission
        self._simulate_edit_submission(instance)

        # Ensure the `_submitted_by` field remains unchanged after edit
        instance.refresh_from_db()
        assert instance.parsed_instance.submitted_by == original_submitted_by

    def test_submitted_by_persists_for_shared_submitter(self):
        """
        Test that the `_submitted_by` field remains correct when:

        1. Share the project with anotheruser
        2. Make anotheruser submit data to the shared project
        3. Delete the submitting user
        4. Edit the submission
        5. Bulk update the same submission
        6. Ensure the `_submitted_by` field remains correct throughout
        the process.
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
            'q1': 'initial value',
        }
        self.asset.deployment.mock_submissions([submission])
        root_uuid = remove_uuid_prefix(submission['_uuid'])
        instance = Instance.objects.get(root_uuid=root_uuid)

        # Simulate old submission that does not have submitted_by stored
        ParsedInstance.objects.filter(instance=instance).update(submitted_by=None)
        deleted_username = self.anotheruser.username

        # 3. Delete the submitting user
        self.anotheruser.delete()

        # After deletion, the submission detail should still show the username
        detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={'uid_asset': self.asset.uid, 'pk': instance.pk},
        )
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['_submitted_by'] == deleted_username

        # 4. Edit the submission
        self._simulate_edit_submission(instance)

        # Ensure the edited submission still shows the original submitted_by
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['_submitted_by'] == deleted_username

        # Ensure ProjectHistoryLog has the correct submitted_by
        ph_edit = (
            ProjectHistoryLog.objects.filter(
                metadata__submission__root_uuid=instance.root_uuid,
            )
            .order_by('-date_created')
            .first()
        )
        assert ph_edit.metadata['submission']['submitted_by'] == deleted_username

        # 5. Bulk update the same submission
        bulk_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={'uid_asset': self.asset.uid},
        )
        payload = {
            'payload': {
                'submission_ids': [instance.pk],
                'data': {'q1': 'bulk-updated value'},
            }
        }
        response = self.client.patch(bulk_url, data=payload, format='json')
        assert response.status_code == status.HTTP_200_OK

        # Ensure the updated submission still shows the original submitted_by
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['_submitted_by'] == deleted_username

        # Ensure ProjectHistoryLog has the correct submitted_by
        ph_bulk = (
            ProjectHistoryLog.objects.filter(
                metadata__submission__root_uuid=instance.root_uuid,
            )
            .order_by('-date_created')
            .first()
        )
        assert ph_bulk.metadata['submission']['submitted_by'] == deleted_username

    @data(
        # Both root_uuid are null
        (True, True),
        # Original root_uuid is null, duplicate has a value
        (True, False),
        # Original root_uuid has a value, duplicate is null
        (False, True),
        # Both root_uuid have values
        (False, False),
    )
    @unpack
    def test_cannot_edit_duplicate_submissions(
        self, orig_root_uuid_is_null, duplicate_root_uuid_is_null
    ):
        """
        Test editing submissions when duplicate instances exist with the same UUID.

        A duplicate submission exists with the same UUID.
        This test covers four scenarios based on the root_uuid values:
        - Both original and duplicate have null root_uuid (legacy submissions)
        - Original has null root_uuid, duplicate has a value
        - Original has a value, duplicate has null root_uuid
        - Both have non-null root_uuid values

        In all cases, attempting to get the edit link should return 409 CONFLICT
        because the system cannot safely determine which submission to edit.
        """

        # Get the current submission's UUID
        submission_uuid = remove_uuid_prefix(self.submission['_uuid'])

        if orig_root_uuid_is_null:
            # Set the original submission's root_uuid to null to simulate legacy data
            Instance.objects.filter(pk=self.submission['_id']).update(root_uuid=None)

        # Create a duplicate instance with the same UUID
        different_root_uuid = str(uuid.uuid4())
        duplicate = Instance.objects.create(
            xml=self.asset.deployment.get_submission(
                self.submission['_id'], self.asset.owner, SUBMISSION_FORMAT_TYPE_XML
            ),
            user=self.someuser,
            xform_id=self.asset.deployment.xform_id,
            uuid=submission_uuid,
            root_uuid=different_root_uuid,
        )
        ParsedInstance.objects.create(instance=duplicate)

        if duplicate_root_uuid_is_null:
            # Set the duplicate submission's root_uuid to null to simulate legacy data
            Instance.objects.filter(pk=duplicate.pk).update(root_uuid=None)

        # Verify we have 2 instances with the same UUID
        assert (
            Instance.objects.filter(
                uuid=submission_uuid,
                xform_id=self.asset.deployment.xform_id,
            ).count()
            == 2
        )

        # Attempt to get the edit link - should fail with 409
        submission_edit_link_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )

        response = self.client.get(submission_edit_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'cannot be edited' in response.data['detail']

        # Sanity check! Try with the duplicate - should get the same result
        submission_edit_link_url = reverse(
            self._get_endpoint('submission-enketo-edit'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': duplicate.pk,
            },
        )
        response = self.client.get(submission_edit_link_url, {'format': 'json'})
        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'cannot be edited' in response.data['detail']

    def _get_submission(self, instance: Instance) -> dict:
        """
        Read the submission back through the API, which is what this test is
        about, rather than off the `Instance.json` column.
        """

        response = self.client.get(self.submission_list_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK
        return next(
            submission
            for submission in response.data['results']
            if submission['_id'] == instance.pk
        )


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
            },
        }
        current_time = datetime.now(tz=ZoneInfo('UTC')).isoformat('T', 'milliseconds')
        self._add_submissions(other_fields={'start': current_time, 'end': current_time})

        self.submission = self.submissions_submitted_by_someuser[0]
        self.submission_url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'uid_asset': self.asset.uid,
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


class SubmissionDuplicateApiTests(
    SubmissionEditTestCaseMixin, SubmissionDuplicateBaseApiTests
):

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

        partial_perms = {PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}

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
                'uid_asset': self.asset.uid,
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
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.post(url, {'format': 'json'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self._check_duplicate(response, submission)

    def test_duplicate_submission_with_extras(self):
        dummy_extra = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    '_dateCreated': '2025-01-01T00:00:00Z',
                    '_dateModified': '2025-01-01T00:00:00Z',
                    '_versions': [
                        {
                            '_dateCreated': '2025-01-01T00:00:00Z',
                            '_dateAccepted': '2025-01-01T00:00:00Z',
                            '_data': {
                                'value': 'dummy transcription',
                                'langaugeCode': 'en',
                            },
                            '_uuid': '12345',
                        }
                    ],
                },
                'manual_translation': {
                    '_dateCreated': '2025-01-01T00:00:00Z',
                    '_dateModified': '2025-01-01T00:00:00Z',
                    '_versions': [
                        {
                            '_dateCreated': '2025-01-01T00:00:00Z',
                            '_dateAccepted': '2025-01-01T00:00:00Z',
                            '_data': {
                                'value': 'dummy translation',
                                'langaugeCode': 'xx',
                            },
                            '_uuid': '678910',
                        }
                    ],
                },
            },
        }
        SubmissionSupplement.objects.create(
            submission_uuid=self.submission['_uuid'],
            asset=self.asset,
            content=dummy_extra,
        )
        response = self.client.post(self.submission_url, {'format': 'json'})
        duplicated_submission = response.data
        duplicated_extra = self.asset.submission_extras.filter(
            submission_uuid=duplicated_submission['_uuid']
        ).first()
        assert (
            duplicated_extra.content['q1']['manual_translation']['_versions'][0][
                '_data'
            ]['value']
            == dummy_extra['q1']['manual_translation']['_versions'][0]['_data']['value']
        )
        assert (
            duplicated_extra.content['q1']['manual_transcription']['_versions'][0][
                '_data'
            ]['value']
            == dummy_extra['q1']['manual_transcription']['_versions'][0]['_data'][
                'value'
            ]
        )

    def test_duplicate_edited_submission(self):
        """
        someuser is the owner of the project.
        someuser is allowed to duplicate their own data
        """
        deployment = self.asset.deployment
        instance = Instance.objects.get(root_uuid=self.submission['_uuid'])
        self._simulate_edit_submission(instance)

        submission = deployment.get_submission(instance.pk, self.asset.owner)
        assert deployment.SUBMISSION_DEPRECATED_UUID_XPATH in submission

        response = self.client.post(self.submission_url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED
        self._check_duplicate(response)

        duplicated_instance = Instance.objects.get(
            root_uuid=remove_uuid_prefix(
                response.data[deployment.SUBMISSION_ROOT_UUID_XPATH]
            )
        )
        # `rootUuid` should be present in MongoDB but different from the source, but
        # should not be present in the duplicated submission XML
        assert (
            submission[deployment.SUBMISSION_ROOT_UUID_XPATH]
            != response.data[deployment.SUBMISSION_ROOT_UUID_XPATH]
        )
        assert 'rootUuid' not in duplicated_instance.xml
        # `deprecatedID` should not be present in MongoDB, neither in the duplicated
        # submission XML
        assert deployment.SUBMISSION_DEPRECATED_UUID_XPATH not in response.data
        assert 'deprecatedID' not in duplicated_instance.xml

    def test_duplicate_submission_attachment_uses_own_root_uuid(self):
        """
        The duplicate's attachment must be stored under a folder named
        after the duplicate's own root_uuid, not the source submission's.
        """
        submission = {
            '__version__': self.asset.latest_deployed_version.uid,
            'q1': 'foo',
            'meta/instanceID': f'uuid:{uuid.uuid4()}',
            '_attachments': [{'filename': 'IMG_4266-11_38_22.jpg'}],
        }
        self.asset.deployment.mock_submissions([submission])

        source_instance = Instance.objects.get(pk=submission['_id'])
        source_attachment = source_instance.attachments.get()
        assert (
            source_attachment.media_file.name.split('/')[-2]
            == source_instance.root_uuid
        )

        url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        response = self.client.post(url, {'format': 'json'})
        assert response.status_code == status.HTTP_201_CREATED

        duplicated_instance = Instance.objects.get(pk=response.data['_id'])
        duplicated_attachment = duplicated_instance.attachments.get()

        assert duplicated_instance.root_uuid != source_instance.root_uuid
        assert (
            duplicated_attachment.media_file.name.split('/')[-2]
            == duplicated_instance.root_uuid
        )
        assert (
            duplicated_attachment.media_file.name != source_attachment.media_file.name
        )


class BulkUpdateSubmissionsApiTests(BaseSubmissionTestCase):

    def setUp(self):
        super().setUp()
        self._add_submissions()
        self.submission_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'uid_asset': self.asset.uid,
            },
        )

        submissions = self.submissions_submitted_by_someuser
        self.updated_submission_data = {
            'submission_ids': [rs['_id'] for rs in submissions],
            'data': {'q1': 'Updated value', 'q_new': 'A new question and value'},
        }

        self.submitted_payload = {'payload': self.updated_submission_data}

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

        # Not really testing the API, but let's validate everything is in place
        # with the ORM, i.e.: instance.xml contains a <meta/rootUuid> node that matches
        # with instance.root_uuid
        instances = Instance.objects.filter(
            pk__in=self.updated_submission_data['submission_ids']
        )
        for instance in instances:
            for result in response.data['results']:
                if result['uuid'] == instance.uuid:
                    assert instance.root_uuid == result['root_uuid']
                    xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
                    root_uuid = xml_parsed.find(
                        self.asset.deployment.SUBMISSION_ROOT_UUID_XPATH
                    )
                    assert root_uuid is not None
                    assert result['root_uuid'] == remove_uuid_prefix(root_uuid.text)
                    break

    def test_bulk_update_submissions_records_form_versions(self):
        """
        A bulk edit performed while a newer version is deployed must tag the
        submissions with both versions, oldest first.
        """

        original_version_uid = self.asset.latest_deployed_version.uid

        self.asset.content['survey'].append(
            {'type': 'note', 'name': 'n', 'label': ['A new note']}
        )
        self.asset.save()
        self.asset.deploy(active=True)
        self.asset.save()
        new_version_uid = self.asset.latest_deployed_version.uid
        assert new_version_uid != original_version_uid

        response = self.client.patch(
            self.submission_url, data=self.submitted_payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self._check_bulk_update(response)

        response = self.client.get(self.submission_list_url, {'format': 'json'})
        assert response.status_code == status.HTTP_200_OK

        edited_ids = self.updated_submission_data['submission_ids']
        edited = [s for s in response.data['results'] if s['_id'] in edited_ids]
        assert len(edited) == len(edited_ids)
        for submission in edited:
            assert submission[META_FORM_VERSIONS] == (
                f'{original_version_uid} {new_version_uid}'
            )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(USAGE_LIMIT_ENFORCEMENT=True)
    @mock.patch(
        'kobo.apps.openrosa.libs.utils.logger_tools.ServiceUsageCalculator.get_usage_balances'  # noqa: E501
    )
    def test_bulk_update_submissions_ignores_limit_enforcement(self, mock_usage):
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'exceeded': True,
            },
            UsageType.SUBMISSION: {
                'exceeded': True,
            },
        }
        mock_usage.return_value = mock_balances
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
            assert 'xmlns="http://opendatakit.org/submissions"' in submission_xml
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
        partial_perms = {PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}

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
