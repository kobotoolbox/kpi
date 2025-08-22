import pytest
from ddt import data, ddt, unpack
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences__new.tests.api.v2.base import SubsequenceBaseTestCase
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.utils.object_permission import get_anonymous_user

@ddt
class SubsequencePermissionTestCase(SubsequenceBaseTestCase):

    @data(
        # owner: Obviously, no need to share.
        (
            'someuser',
            False,
            status.HTTP_200_OK,
        ),
        # regular user with no permissions
        (
            'anotheruser',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # regular user with view permission
        (
            'anotheruser',
            True,
            status.HTTP_200_OK,
        ),
        # admin user with no permissions
        (
            'adminuser',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # admin user with view permissions
        (
            'adminuser',
            True,
            status.HTTP_200_OK,
        ),
        # anonymous user with no permissions
        (
            'anonymous',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # anonymous user with view permissions
        (
            'anonymous',
            True,
            status.HTTP_200_OK,
        ),
    )
    @unpack
    def test_can_read(self, username, shared, status_code):
        user = get_anonymous_user()
        self.client.logout()
        if username != 'anonymous':
            user = User.objects.get(username=username)
            self.client.force_login(user)

        if shared:
            self.asset.assign_perm(user, PERM_VIEW_SUBMISSIONS)

        response = self.client.get(self.supplement_details_url)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            assert response.data == {}

    @data(
        # owner: Obviously, no need to share.
        (
            'someuser',
            False,
            status.HTTP_200_OK,
        ),
        # regular user with no permissions
        (
            'anotheruser',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # regular user with view permission
        (
            'anotheruser',
            True,
            status.HTTP_200_OK,
        ),
        # admin user with no permissions
        (
            'adminuser',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # admin user with view permissions
        (
            'adminuser',
            True,
            status.HTTP_200_OK,
        ),
        # anonymous user with no permissions
        (
            'anonymous',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
    )
    @unpack
    def test_can_write(self, username, shared, status_code):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'es',
                    'transcript': 'buenas noches',
                }
            },
        }

        user = get_anonymous_user()
        self.client.logout()
        if username != 'anonymous':
            user = User.objects.get(username=username)
            self.client.force_login(user)

        if shared:
            self.asset.assign_perm(user, PERM_CHANGE_SUBMISSIONS)

        response = self.client.patch(self.supplement_details_url, data=payload)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            assert response.data == {}


class SubsequencePartialPermissionTestCase(SubsequenceBaseTestCase):
    """
    Ensure that users with partial change_submission permission cannot access or
    update submission supplement data, especially for submissions they are not
    authorized to view.
    """

    def test_cannot_post_data(self):
        anotheruser = User.objects.get(username='anotheruser')
        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': anotheruser.username}]
        }
        self.asset.assign_perm(
            anotheruser, PERM_PARTIAL_SUBMISSIONS, partial_perms=partial_perms
        )
        self.client.force_login(anotheruser)
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'es',
                    'transcript': 'buenas noches',
                }
            },
        }
        response = self.client.post(self.supplement_details_url, data=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_read_data(self):
        anotheruser = User.objects.get(username='anotheruser')
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': anotheruser.username}]
        }
        self.asset.assign_perm(
            anotheruser, PERM_PARTIAL_SUBMISSIONS, partial_perms=partial_perms
        )
        self.client.force_login(anotheruser)
        response = self.client.get(self.supplement_details_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND
