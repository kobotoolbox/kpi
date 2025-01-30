import base64
import os

import pytest
from django.urls.exceptions import NoReverseMatch
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from .test_abstract_viewset import TestAbstractViewSet


class TestUserViewSet(TestAbstractViewSet):

    def setUp(self):
        alice_profile_data = {
            'username': 'alice',
            'email': 'alice@kobotoolbox.org',
            'password1': 'alice',
            'password2': 'alice',
            'name': 'Alice',
            'city': 'AliceTown',
            'country': 'CA',
            'organization': 'Alice Inc.',
            'home_page': 'alice.com',
            'twitter': 'alicetwitter'
        }

        admin_profile_data = {
            'username': 'admin',
            'email': 'admin@kobotoolbox.org',
            'password1': 'admin',
            'password2': 'admin',
            'name': 'Administrator',
            'city': 'AdminTown',
            'country': 'CA',
            'organization': 'Admin Inc.',
            'home_page': 'admin.com',
            'twitter': 'admintwitter'
        }

        alice_profile = self._create_user_profile(alice_profile_data)
        admin_profile = self._create_user_profile(admin_profile_data)
        bob_profile = self._create_user_profile(self.default_profile_data)
        self.alice = alice_profile.user
        self.admin = admin_profile.user
        self.bob = bob_profile.user

    def test_no_access_to_users_list(self):
        # anonymous user
        pattern = (
            r"^Reverse for 'user-list' not found. 'user-list' is not a valid view "
            "function or pattern name.$"
        )
        with pytest.raises(NoReverseMatch, match=pattern) as e:
            reverse('user-list')

    def test_no_access_to_user_detail(self):
        # anonymous user
        self.client.logout()
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # bob
        self.client.login(username='bob', password='bobbob')
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_superuser_cannot_access_user_detail(self):
        self.client.login(username='admin', password='admin')
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_superuser_cannot_delete_user(self):
        self.client.login(username='admin', password='admin')
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.delete(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_access_myself_detail(self):
        self.client.login(username='alice', password='alice')
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.delete(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_myself(self):
        self.client.login(username='alice', password='alice')
        url = reverse('user-detail', args=(self.alice.username,))
        response = self.client.delete(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_only_open_rosa_endpoints_allowed_with_not_validated_password(self):
        # log in as bob
        self._login_user_and_profile()
        self.user.profile.validated_password = True
        self.user.profile.save()

        # Password is valid, bob should be able to create a new form, submit data
        # and browse the API
        self.publish_xls_form()
        self._submit_data()
        assert self.response.status_code == status.HTTP_201_CREATED
        # Validate bob is allowed to access all endpoints
        self._access_endpoints(access_granted=True)

        # Flag Bob's password as not trusted
        self.user.profile.validated_password = False
        self.user.profile.save()
        # Access denied to API endpoints with not validated password - Session auth
        self._access_endpoints(access_granted=False)
        # Still able to submit data
        self._submit_data()
        # We are sending a duplicate, we should receive a 202 if not blocked
        assert self.response.status_code == status.HTTP_202_ACCEPTED

        # Access denied to API endpoints with not validated password - Basic auth
        self.client.logout()
        headers = {
            'HTTP_AUTHORIZATION': 'Basic '
            + base64.b64encode(b'bob:bobbob').decode('ascii')
        }
        self._access_endpoints(access_granted=False, headers=headers)
        # Still able to submit data
        self._submit_data()
        # We are sending a duplicate, we should receive a 202 if not blocked
        assert self.response.status_code == status.HTTP_202_ACCEPTED

        # Access denied to API endpoints with not validated password - Token auth
        headers = {
            'HTTP_AUTHORIZATION': f'Token {self.user.auth_token}'
        }
        self._access_endpoints(access_granted=False, headers=headers)
        # Still able to submit data
        self._submit_data()
        # We are sending a duplicate, we should receive a 202 if not blocked
        assert self.response.status_code == status.HTTP_202_ACCEPTED

    def _access_endpoints(self, access_granted: bool, headers: dict = {}):
        """
        Validate if `GET` requests return expected status code.

        The list of endpoints is not exhaustive but should cover the main ones.
        TODO: Support other methods
        """
        status_code = (
            status.HTTP_200_OK if access_granted else status.HTTP_403_FORBIDDEN
        )
        xform_id = self.xform.pk
        instance_id = self.xform.instances.all().order_by('id')[0].pk
        attachment_id = (
            self.xform.instances.all()[0].attachments.all().order_by('id')[0].pk
        )

        # /api/v1/forms
        response = self.client.get(reverse('xform-list'), **headers)
        assert response.status_code == status_code

        response = self.client.get(
            reverse('xform-detail', kwargs={'pk': xform_id}), **headers
        )
        assert response.status_code == status_code

        response = self.client.get(
            reverse('xform-form', kwargs={'pk': xform_id}), **headers
        )
        assert response.status_code == status_code

        response = self.client.get(
            reverse('xform-labels', kwargs={'pk': xform_id}), **headers
        )
        assert response.status_code == status_code

        # /api/v1/data
        response = self.client.get(reverse('data-list'), **headers)
        assert response.status_code == status_code

        response = self.client.get(
            reverse(
                'data-detail', kwargs={'pk': xform_id, 'dataid': instance_id}
            ),
            **headers,
        )
        assert response.status_code == status_code

        response = self.client.get(
            reverse(
                'data-validation-status',
                kwargs={'pk': xform_id, 'dataid': instance_id},
            ),
            **headers,
        )
        assert response.status_code == status_code

        # /api/v1/media
        response = self.client.get(reverse('attachment-list'), **headers)
        assert response.status_code == status_code

        response = self.client.get(
            reverse('attachment-detail', kwargs={'pk': attachment_id}),
            **headers,
        )
        assert response.status_code == status_code

        # /api/v1/metadata
        response = self.client.get(reverse('metadata-list'), **headers)
        assert response.status_code == status_code

        # TODO add media file to xform
        # response = self.client.get(reverse('metadata-list', kwargs={'pk': metadata_id}), **headers))
        # assert response.status_code == status_code

        # /api/v1/user
        response = self.client.get(reverse('userprofile-list'), **headers)
        assert response.status_code == status_code

        # exports (old views). Test only csv.
        # /<username>/exports/<xform_id_string>/<export_type>/
        response = self.client.get(
            reverse(
                'export_list',
                kwargs={
                    'username': 'bob',
                    'id_string': self.xform.id_string,
                    'export_type': 'csv',
                },
            ),
            **headers,
        )
        assert response.status_code == status_code

        #########################################################
        # OpenRosa endpoints. Should be granted no matter what. #
        #########################################################
        # Xforms list
        response = self.client.get(reverse('form-list'), **headers)
        assert response.status_code == status.HTTP_200_OK

        response = self.client.get(
            reverse('form-list', kwargs={'username': 'bob'}), **headers
        )
        assert response.status_code == status.HTTP_200_OK

        # XForm manifest
        response = self.client.get(
            reverse('manifest-url', kwargs={'pk': xform_id}), **headers
        )
        assert response.status_code == status.HTTP_200_OK

        # Need to deactivate auth on XForm when using OpenRosa endpoints with username
        XForm.objects.filter(pk=xform_id).update(require_auth=False)
        response = self.client.get(
            reverse('manifest-url', kwargs={'pk': xform_id, 'username': 'bob'}),
            **headers,
        )
        assert response.status_code == status.HTTP_200_OK

        # XForm XML
        response = self.client.get(
            reverse(
                'download_xform', kwargs={'pk': xform_id, 'username': 'bob'}
            ),
            **headers,
        )
        assert response.status_code == status.HTTP_200_OK

    def _submit_data(self):
        survey_datetime = self.surveys[0]
        xml_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_datetime,
            f'{survey_datetime}.xml',
        )
        media_file_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_datetime,
            '1335783522563.jpg'
        )
        with open(media_file_path, 'rb') as media_file:
            self._make_submission(xml_path, media_file=media_file)
