# flake8: noqa: E501
import uuid
from unittest.mock import MagicMock, patch

from constance.test import override_config
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.project_ownership.models import Invite, InviteStatusChoices, Transfer
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.constants import PERM_VIEW_ASSET
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.tests.utils.transaction import immediate_on_commit
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ProjectOwnershipAPITestCase(KpiTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:

        super().setUp()
        User = get_user_model()  # noqa
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.thirduser = User.objects.create_user(
            username='thirduser',
            password='thirduser',
            email='thirduser@example.com',
        )

        self.invite_url = reverse(
            self._get_endpoint('project-ownership-invite-list')
        )
        self.asset = Asset.objects.get(pk=1)

    def test_can_create_invite_as_asset_owner(self):

        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

    def test_cannot_create_bulk_invite_with_not_all_own_assets(self):

        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username],
            ),
            'assets': [self.asset.uid, 'not_owned_asset_uid'],
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_create_invite_as_regular_user(self):

        self.client.login(username='thirduser', password='thirduser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class ProjectOwnershipInviteAPITestCase(KpiTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:

        super().setUp()
        User = get_user_model()  # noqa
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.thirduser = User.objects.create_user(
            username='thirduser',
            password='thirduser',
            email='thirduser@example.com',
        )
        self.asset = Asset.objects.get(pk=1)
        self.asset.save()  # Set asset permissions for owner
        self.invite = Invite.objects.create(
            sender=self.someuser, recipient=self.anotheruser
        )
        self.transfer = Transfer.objects.create(
            invite=self.invite, asset=self.asset
        )
        self.invite_detail_url = reverse(
            self._get_endpoint('project-ownership-invite-detail'),
            args=[self.invite.uid],
        )

    def test_can_cancel_invite_as_sender(self):

        self.client.login(username='someuser', password='someuser')
        payload = {
            'status': InviteStatusChoices.CANCELLED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == InviteStatusChoices.CANCELLED

    def test_cannot_cancel_invite_as_regular_sender(self):

        self.client.login(username='thirduser', password='thirduser')
        payload = {
            'status': InviteStatusChoices.CANCELLED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_cancel_invite_as_recipient(self):

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.CANCELLED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_can_accept_invite_as_recipient(self):

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.ACCEPTED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == InviteStatusChoices.IN_PROGRESS

    def test_can_decline_invite_as_recipient(self):

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.DECLINED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == InviteStatusChoices.DECLINED

    def test_cannot_accept_invite_as_sender(self):

        self.client.login(username='someuser', password='someuser')
        payload = {
            'status': InviteStatusChoices.ACCEPTED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_decline_invite_as_sender(self):

        self.client.login(username='someuser', password='someuser')
        payload = {
            'status': InviteStatusChoices.DECLINED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_change_in_progress_invite(self):

        self.invite.status = InviteStatusChoices.IN_PROGRESS
        self.invite.save()

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.DECLINED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_change_complete_invite(self):
        self.invite.status = InviteStatusChoices.COMPLETE
        self.invite.save()

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.DECLINED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_change_failed_invite(self):
        self.invite.status = InviteStatusChoices.FAILED
        self.invite.save()

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.ACCEPTED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_change_expired_invite(self):
        self.invite.status = InviteStatusChoices.EXPIRED
        self.invite.save()

        self.client.login(username='anotheruser', password='anotheruser')
        payload = {
            'status': InviteStatusChoices.ACCEPTED
        }
        response = self.client.patch(
            self.invite_detail_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invite_set_as_cancelled_on_project_deletion(self):

        self.client.login(username='someuser', password='someuser')
        assert self.invite.status == InviteStatusChoices.PENDING
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'),
            args=[self.asset.uid],
        )
        response = self.client.delete(asset_detail_url)
        # Should be a 204, but DRF Browsable API renderer (the default)
        # alter the status code and returns a 200 instead.
        # All other deletion tests on Asset assert a 200 either.
        assert response.status_code == status.HTTP_200_OK

        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(self.invite_detail_url, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == InviteStatusChoices.CANCELLED


class ProjectOwnershipTransferDataAPITestCase(BaseAssetTestCase):
    """
    Tests in this class use the mock library a lot because transferring a
    deployed project implies accessing KoboCAT tables. However, KPI does not
    support it.
    """

    URL_NAMESPACE = ROUTER_URL_NAMESPACE
    fixtures = ['test_data']

    def setUp(self) -> None:
        super().setUp()
        User = get_user_model()  # noqa
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.invite_url = reverse(self._get_endpoint('project-ownership-invite-list'))
        content_source_asset = {
            'survey': [
                {
                    'type': 'audio',
                    'label': 'q1',
                    'required': 'false',
                    '$kuid': 'abcd',
                },
                {
                    'type': 'file',
                    'label': 'q2',
                    'required': 'false',
                    '$kuid': 'efgh',
                },
            ]
        }
        self.asset = Asset.objects.create(
            content=content_source_asset,
            owner=self.someuser,
            asset_type='survey',
        )
        self.asset.deploy(backend='mock', active=True)
        self.__add_submissions()
        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        # Add fake NLP usage
        update_nlp_counter(
            service='mock_nlp_service_asr_seconds',
            amount=120,
            user_id=self.someuser.pk,
            asset_id=self.asset.pk,
        )
        update_nlp_counter(
            service='mock_nlp_service_mt_characters',
            amount=1000,
            user_id=self.someuser.pk,
            asset_id=self.asset.pk,
        )

    def __add_submissions(self):
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid
        _uuid = str(uuid.uuid4())
        submission = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': _uuid,
            'meta/instanceID': f'uuid:{_uuid}',
            'formhub/uuid': self.asset.uid,
            '_attachments': [
                {
                    'download_url': 'http://testserver/someuser/audio_conversion_test_clip.3gp',
                    'filename': 'someuser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                    'bytes': 5000,
                },
                {
                    'download_url': 'http://testserver/someuser/audio_conversion_test_image.jpg',
                    'filename': 'someuser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                    'bytes': 10000,
                },
            ],
            '_submitted_by': 'someuser'
        }
        submissions.append(submission)
        self.asset.deployment.mock_submissions(submissions)
        self.submissions = submissions

    @patch(
        'kobo.apps.project_ownership.models.transfer.reset_kc_permissions',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_attachments',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_media_files',
        MagicMock()
    )
    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
    )
    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_account_usage_transferred_to_new_user(self):
        expected_data = {
            'total_nlp_usage': {
                'asr_seconds_current_period': 120,
                'mt_characters_current_period': 1000,
                'asr_seconds_all_time': 120,
                'mt_characters_all_time': 1000,
            },
            'total_storage_bytes': 191642,
            'total_submission_count': {
                'all_time': 1,
                'current_period': 1,
            },
        }

        expected_empty_data = {
            'total_nlp_usage': {
                'asr_seconds_current_period': 0,
                'mt_characters_current_period': 0,
                'asr_seconds_all_time': 0,
                'mt_characters_all_time': 0,
            },
            'total_storage_bytes': 0,
            'total_submission_count': {
                'all_time': 0,
                'current_period': 0,
            },
        }

        service_usage_url = reverse(
            self._get_endpoint('service-usage-list'),
        )
        # someuser has some usage metrics
        self.client.login(username='someuser', password='someuser')
        response = self.client.get(service_usage_url)
        assert response.data['total_nlp_usage'] == expected_data['total_nlp_usage']
        assert response.data['total_storage_bytes'] == expected_data['total_storage_bytes']
        assert response.data['total_submission_count'] == expected_data['total_submission_count']

        # anotheruser's usage should be 0
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(service_usage_url)
        assert response.data['total_nlp_usage'] == expected_empty_data['total_nlp_usage']
        assert response.data['total_storage_bytes'] == expected_empty_data['total_storage_bytes']
        assert response.data['total_submission_count'] == expected_empty_data['total_submission_count']

        # Transfer the project from someuser to anotheruser
        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        with immediate_on_commit():
            response = self.client.post(
                self.invite_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_201_CREATED

        # someuser should have no usage reported anymore
        response = self.client.get(service_usage_url)
        assert response.data['total_nlp_usage'] == expected_empty_data['total_nlp_usage']
        assert response.data['total_storage_bytes'] == expected_empty_data['total_storage_bytes']
        assert response.data['total_submission_count'] == expected_empty_data['total_submission_count']

        # anotheruser should now have usage reported
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(service_usage_url)
        assert response.data['total_nlp_usage'] == expected_data['total_nlp_usage']
        assert response.data['total_storage_bytes'] == expected_data['total_storage_bytes']
        assert response.data['total_submission_count'] == expected_data['total_submission_count']

    @patch(
        'kobo.apps.project_ownership.models.transfer.reset_kc_permissions',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_attachments',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_media_files',
        MagicMock()
    )
    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_data_accessible_to_new_user(self):

        self.client.login(username='anotheruser', password='anotheruser')
        data_url = reverse(
            self._get_endpoint('submission-list'), args=[self.asset.uid]
        )

        # anotheruser does not have permissions on someuser's project
        response = self.client.get(data_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Validate Mongo documents directly
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': f'someuser_{self.asset.uid}'}
            ) == 1
        )
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': f'anotheruser_{self.asset.uid}'}
            ) == 0
        )

        # Transfer the project from someuser to anotheruser
        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }

        with immediate_on_commit():
            response = self.client.post(
                self.invite_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_201_CREATED

        # anotheruser is the owner and should see the project
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(data_url, args=[self.asset.uid])
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        for attachment in response.data['results'][0]['_attachments']:
            assert attachment['filename'].startswith('anotheruser/')

        # Get the mongo_uuid for the transferred asset (XForm)
        self.asset.deployment.xform.refresh_from_db()
        mongo_uuid = self.asset.deployment.xform.mongo_uuid

        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': f'someuser_{self.asset.uid}'}
            ) == 0
        )
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': mongo_uuid}
            ) == 1
        )

    @patch(
        'kobo.apps.project_ownership.models.transfer.reset_kc_permissions',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_attachments',
        MagicMock()
    )
    @patch(
        'kobo.apps.project_ownership.tasks.move_media_files',
        MagicMock()
    )
    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_mongo_uuid_after_transfer(self):
        """
        Test that after an ownership transfer, the XForm's MongoDB document
        updates to use the `mongo_uuid` as the `_userform_id` instead of the
        original owner's identifier
        """
        self.client.login(username='someuser', password='someuser')
        original_userform_id = f'someuser_{self.asset.uid}'
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': original_userform_id}
            ) == 1
        )

        # Transfer the project from someuser to anotheruser
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }

        with immediate_on_commit():
            response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        # Get the mongo_uuid for the transferred asset (XForm)
        self.asset.deployment.xform.refresh_from_db()
        mongo_uuid = self.asset.deployment.xform.mongo_uuid

        # Verify MongoDB now uses mongo_uuid as the identifier
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': mongo_uuid}
            ) == 1
        )

        # Confirm the original `_userform_id` is no longer used
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': original_userform_id}
            ) == 0
        )


class ProjectOwnershipInAppMessageAPITestCase(KpiTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:

        super().setUp()
        User = get_user_model()  # noqa
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.invite_url = reverse(self._get_endpoint('project-ownership-invite-list'))
        self.asset = Asset.objects.get(pk=1)
        self.alice = User.objects.create_user(
            username='alice', password='alice', email='alice@example.com'
        )

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_shared_users_receive_in_app_message(self):

        self.asset.assign_perm(self.alice, PERM_VIEW_ASSET)
        self.client.login(username='alice', password='alice')
        # in-app message has not migrated to API `v2`.
        # No need to use `_get_endpoint` utility
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        self.client.login(username='alice', password='alice')
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 1

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_other_users_do_not_receive_in_app_message(self):
        self.client.login(username='alice', password='alice')

        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        self.client.login(username='alice', password='alice')
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_previous_owner_do_not_receive_in_app_message(self):

        self.client.login(username='someuser', password='someuser')
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def test_new_owner_do_not_receive_in_app_message(self):

        self.client.login(username='anotheruser', password='anotheruser')
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0

        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.anotheruser.username]
            ),
            'assets': [self.asset.uid]
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        self.client.login(username='anotheruser', password='anotheruser')
        in_app_response = self.client.get(reverse('inappmessage-list'))
        assert in_app_response.status_code == status.HTTP_200_OK
        assert in_app_response.data['count'] == 0
