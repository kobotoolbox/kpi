import uuid
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from ddt import data, ddt, unpack
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
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
        # regular user with change permission
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
        # admin user with change permissions
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
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'es'}],
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


@ddt
class AdvancedFeaturesPermissionTestCase(SubsequenceBaseTestCase):

    def setUp(self):
        super().setUp()
        self.advanced_features_url = reverse(
            'api_v2:advanced-features-list', args=(self.asset.uid,)
        )
        with patch(
            'kobo.apps.subsequences.models.KpiUidField.generate_uid',
            return_value='12345',
        ):
            QuestionAdvancedFeature.objects.create(
                asset=self.asset,
                action='manual_transcription',
                question_xpath='q1',
                params=[{'language': 'en'}],
            )

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
            self.asset.assign_perm(user, PERM_VIEW_ASSET)

        response = self.client.get(self.advanced_features_url)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            assert response.data == [
                {
                    'question_xpath': 'q1',
                    'uid': '12345',
                    'params': [{'language': 'en'}],
                    'action': 'manual_transcription',
                }
            ]

    @data(
        # owner: Obviously, no need to share.
        (
            'someuser',
            False,
            status.HTTP_201_CREATED,
        ),
        # regular user with no permissions
        (
            'anotheruser',
            False,
            status.HTTP_404_NOT_FOUND,
        ),
        # regular user with change submission permission
        (
            'anotheruser',
            True,
            status.HTTP_201_CREATED,
        ),
        # admin user with no permissions
        (
            'adminuser',
            False,
            status.HTTP_201_CREATED,
        ),
        # admin user with change submission permissions
        (
            'adminuser',
            True,
            status.HTTP_201_CREATED,
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
            'action': 'manual_translation',
            'question_xpath': 'q1',
            'params': [{'language': 'es'}],
        }

        user = get_anonymous_user()
        self.client.logout()
        if username != 'anonymous':
            user = User.objects.get(username=username)
            self.client.force_login(user)

        if shared:
            self.asset.assign_perm(user, PERM_CHANGE_SUBMISSIONS)

        frozen_datetime_now = datetime(2024, 4, 8, 15, 27, 0, tzinfo=ZoneInfo('UTC'))
        with freeze_time(frozen_datetime_now):
            response = self.client.post(
                self.advanced_features_url, data=payload, format='json'
            )

        assert response.status_code == status_code
        if response.status_code == status.HTTP_201_CREATED:
            assert QuestionAdvancedFeature.objects.filter(
                asset=self.asset, action='manual_translation'
            ).exists()
