import uuid
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from ddt import data, ddt, unpack
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
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
            status.HTTP_200_OK,
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
            status.HTTP_200_OK,
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
                    'value': 'buenas noches',
                }
            },
        }

        user = get_anonymous_user()
        self.client.logout()
        if username != 'anonymous':
            user = User.objects.get(username=username)
            self.client.force_login(user)

        # Activate advanced features for the project
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'manual_transcription': [
                            {'language': 'es'},
                        ]
                    }
                },
            }
        )

        if shared:
            self.asset.assign_perm(user, PERM_CHANGE_SUBMISSIONS)

        frozen_datetime_now = datetime(2024, 4, 8, 15, 27, 0, tzinfo=ZoneInfo('UTC'))
        fixed_uuid = uuid.UUID('11111111-2222-3333-4444-555555555555')
        with patch('uuid.uuid4', return_value=fixed_uuid):
            with freeze_time(frozen_datetime_now):
                response = self.client.patch(
                    self.supplement_details_url, data=payload, format='json'
                )

        assert response.status_code == status_code

        if status_code == status.HTTP_200_OK:
            expected = {
                '_version': '20250820',
                'q1': {
                    'manual_transcription': {
                        '_dateCreated': '2024-04-08T15:27:00Z',
                        '_dateModified': '2024-04-08T15:27:00Z',
                        '_versions': [
                            {
                                '_data': {
                                    'language': 'es',
                                    'value': 'buenas noches',
                                },
                                '_dateCreated': '2024-04-08T15:27:00Z',
                                '_dateAccepted': '2024-04-08T15:27:00Z',
                                '_uuid': '11111111-2222-3333-4444-555555555555',
                            }
                        ],
                    },
                },
            }
            assert response.data == expected


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
                    'value': 'buenas noches',
                }
            },
        }
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
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
