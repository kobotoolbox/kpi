from constance.test import override_config
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.reverse import reverse

from kpi.constants import PERM_VIEW_ASSET
from kpi.models import Asset
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ProjectOwnershipAPITestCase(KpiTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:
        super().setUp()
        User = get_user_model()  # noqa
        self.anotheruser = User.objects.get(username='anotheruser')
        self.invite_url = reverse(self._get_endpoint('project-ownership-invite-list'))
        self.asset = Asset.objects.get(pk=1)

    def test_can_create_invite_as_asset_owner(self):
        self.client.login(username='someuser', password='someuser')
        payload = {
            'recipient': self.absolute_reverse(
                self._get_endpoint('user-detail'),
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
                self._get_endpoint('user-detail'),
                args=[self.anotheruser.username],
            ),
            'assets': [self.asset.uid, 'not_owned_asset_uid'],
        }
        response = self.client.post(self.invite_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_create_invite_as_regular_user(self):
        pass

    def test_can_cancel_invite_as_sender(self):
        pass

    def test_cannot_cancel_invite_as_regular_sender(self):
        pass

    def test_cannot_cancel_invite_as_recipient(self):
        pass

    def test_can_accept_invite_as_recipient(self):
        pass

    def test_can_decline_invite_as_recipient(self):
        pass

    def test_cannot_accept_invite_as_sender(self):
        pass

    def test_cannot_decline_invite_as_sender(self):
        pass

    def test_cannot_change_in_progress_invite(self):
        pass

    def test_cannot_change_complete_invite(self):
        pass

    def test_cannot_change_failed_invite(self):
        pass

    def test_cannot_change_expired_invite(self):
        pass


class ProjectOwnershipAccountUsageAPITestCase(KpiTestCase):

    def test_account_usage_transfered_to_new_user(self):
        # Use /api/v2/service_usage/
        # Test new_owner usage is 0
        # Test old_owner usage is X
        # Transfer project with submissions, attachments and NLP  to new_owner
        # Test old_owner usage is 0
        # Test old_owner usage is X
        pass


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
                self._get_endpoint('user-detail'),
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

    def test_other_users_do_not_receive_in_app_message(self):
        # same test as test_shared_users_receive_in_app_message but do not give
        # alice 'view_asset' permission
        pass

    def test_previous_owner_do_not_receive_in_app_message(self):
        pass

    def test_new_owner_do_not_receive_in_app_message(self):
        pass
