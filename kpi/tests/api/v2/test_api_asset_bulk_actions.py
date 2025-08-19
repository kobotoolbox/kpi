from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_CHANGE_ASSET,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.models.asset import Asset, AssetDeploymentStatus
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class BaseAssetBulkActionsTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.url = reverse(self._get_endpoint('asset-bulk'))

    def _add_one_asset_for_someuser(self) -> Asset:
        """
        Creates a single asset for someuser
        """
        content = {
            'survey': [
                {
                    'type': 'select_one',
                    'label': 'q1',
                    'select_from_list_name': 'iu0sl99'
                },
            ],
            'choices': [
                {'name': 'a1', 'label': ['a1'], 'list_name': 'iu0sl99'},
                {'name': 'a3', 'label': ['a3'], 'list_name': 'iu0sl99'},
            ]
        }
        asset = Asset.objects.create(
            owner=User.objects.get(username='someuser'),
            content=content,
            asset_type=ASSET_TYPE_SURVEY
        )
        asset.deploy(backend='mock', active=True)
        return asset

    def _create_send_all_payload(self, action: str, confirm: bool) -> Response:
        """
        Create and send a payload in the case where all of a user's assets could
        be archived or deleted.

        confirm: Should fail if set to False
        action: [archive, unarchive, delete, undelete]
        """
        payload = {
            'payload': {
                'confirm': confirm,
                'action': action,
            }
        }
        response = self.client.post(self.url, data=payload, format='json')
        return response

    def _create_send_payload(self, asset_uids: list, action: str) -> Response:
        """
        Create and send a payload in the case where one or more, but not all of
        a user's assets could be archived or deleted.

        asset_uids: [list_of_uids]
        action: [archive, unarchive, delete, undelete]
        """
        payload = {
            'payload': {
                'asset_uids': asset_uids,
                'action': action,
            }
        }
        response = self.client.post(self.url, data=payload, format='json')
        return response

    def _get_asset_detail_results(self, asset_uid: str) -> Response:
        """
        Get the `asset-detail` results for the asset UID provided
        """
        asset_detail_url = reverse(self._get_endpoint('asset-detail'), args=(asset_uid,))
        detail_response = self.client.get(asset_detail_url, format='json')
        return detail_response

    def _login_superuser(self):
        self.client.logout()
        self.client.login(username='adminuser', password='pass')

    def _login_user(self, userpass: str):
        self.client.logout()
        self.client.login(username=userpass, password=userpass)


class AssetBulkArchiveAPITestCase(BaseAssetBulkActionsTestCase):

    def test_archive_all_with_confirm_true(self):
        # Create multiple assets
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)

        # Send request to archive all assets
        response = self._create_send_all_payload('archive', True)
        assert response.status_code == status.HTTP_200_OK

        # Check each Object has the correct settings
        archived_assets = Asset.all_objects.filter(uid__in=asset_uids)
        assert archived_assets.count() == 3
        for archived_asset in archived_assets:
            assert archived_asset.deployment.active is False
            assert archived_asset.pending_delete is False

            # Check if `asset-detail` view is still accessible
            detail_response = self._get_asset_detail_results(archived_asset.uid)
            assert detail_response.status_code == status.HTTP_200_OK
            assert detail_response.data['deployment__active'] is False
            assert (
                detail_response.data['deployment_status']
                == AssetDeploymentStatus.ARCHIVED.value
            )

    def test_archive_all_without_confirm_true(self):
        # Create multiple assets
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)

        # Send request to archive all assets
        response = self._create_send_all_payload('archive', False)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check each Object has the correct settings
        archived_assets = Asset.all_objects.filter(uid__in=asset_uids)
        assert archived_assets.count() == 3
        for archived_asset in archived_assets:
            assert archived_asset.deployment.active is True
            assert archived_asset.pending_delete is False

            # Check if `asset-detail` view is still accessible
            detail_response = self._get_asset_detail_results(archived_asset.uid)
            assert detail_response.status_code == status.HTTP_200_OK
            assert detail_response.data['deployment__active'] is True
            assert (
                detail_response.data['deployment_status']
                == AssetDeploymentStatus.DEPLOYED.value
            )

    def test_user_can_unarchive(self):
        # Archive a project
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        response = self._create_send_payload([asset.uid], 'archive')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is False

        # Ensure someuser still access their project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is False
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.ARCHIVED.value
        )

        # Undo the archiving
        response = self._create_send_payload([asset.uid], 'unarchive')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure someuser can still access their project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_other_user_cannot_archive_others_assets(self):
        self._login_user('anotheruser')
        asset = self._add_one_asset_for_someuser()
        response = self._create_send_payload([asset.uid], 'archive')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure someuser still access their project
        self._login_user('someuser')
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_anonymous_cannot_archive_public(self):
        asset = self._add_one_asset_for_someuser()
        anonymous = get_anonymous_user()
        asset.assign_perm(anonymous, PERM_VIEW_ASSET)
        self.client.logout()
        response = self._create_send_payload([asset.uid], 'archive')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Ensure anonymous user still access someuser's public project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_project_editor_cannot_archive_project(self):
        editor = User.objects.get(username='anotheruser')
        asset = self._add_one_asset_for_someuser()
        asset.assign_perm(editor, PERM_CHANGE_ASSET)
        self._login_user('anotheruser')
        response = self._create_send_payload([asset.uid], 'archive')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Another can still access the project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_project_manager_can_archive_project(self):
        manager = User.objects.get(username='anotheruser')
        asset = self._add_one_asset_for_someuser()
        asset.assign_perm(manager, PERM_MANAGE_ASSET)
        self._login_user('anotheruser')
        response = self._create_send_payload([asset.uid], 'archive')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is False

        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is False
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.ARCHIVED.value
        )

    def test_user_cannot_archive_drafts(self):
        self._login_user('someuser')
        deployed_asset = self._add_one_asset_for_someuser()
        asset = Asset.objects.create(
            owner=User.objects.get(username='someuser'),
            asset_type=ASSET_TYPE_SURVEY
        )
        response = self._create_send_payload(
            [deployed_asset.uid, asset.uid], 'archive'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class AssetBulkDeleteAPITestCase(BaseAssetBulkActionsTestCase):

    def test_anonymous_cannot_delete_public(self):
        asset = self._add_one_asset_for_someuser()
        anonymous = get_anonymous_user()
        asset.assign_perm(anonymous, PERM_VIEW_ASSET)
        self.client.logout()
        response = self._create_send_payload([asset.uid], 'delete')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure anonymous user still access someuser's public project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_delete_all_assets_with_confirm_true(self):
        # Create multiple assets
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)

        # Send request to archive all assets
        response = self._create_send_all_payload('delete', True)
        assert response.status_code == status.HTTP_200_OK

        # Check each Object has the correct settings
        deleted_assets = Asset.all_objects.filter(uid__in=asset_uids)
        assert deleted_assets.count() == 3
        for deleted_asset in deleted_assets:
            assert deleted_asset.deployment.active is False
            assert deleted_asset.pending_delete is True

            # Check if `asset-detail` view is still accessible
            detail_response = self._get_asset_detail_results(deleted_asset.uid)
            assert detail_response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_all_assets_without_confirm_true(self):
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)
        response = self._create_send_all_payload('delete', False)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check each Object has the correct settings
        deleted_assets = Asset.all_objects.filter(uid__in=asset_uids)
        assert deleted_assets.count() == 3
        for deleted_asset in deleted_assets:
            assert deleted_asset.deployment.active is True
            assert deleted_asset.pending_delete is False

            # Check if `asset-detail` view is still accessible
            detail_response = self._get_asset_detail_results(deleted_asset.uid)
            assert detail_response.status_code == status.HTTP_200_OK

    def test_delete_bulk_assets_for_one_user(self):
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)

        kept_asset_uid = asset_uids.pop()

        response = self._create_send_payload(asset_uids, 'delete')
        assert response.status_code == status.HTTP_200_OK
        deleted_assets = Asset.all_objects.filter(
            uid__in=asset_uids, pending_delete=True
        )
        assert deleted_assets.count() == 2
        for deleted_asset in deleted_assets:
            assert deleted_asset.deployment.active is False
            assert deleted_asset.pending_delete is True
            detail_response = self._get_asset_detail_results(deleted_asset.uid)
            assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # Validate that the first asset has been kept
        detail_response = self._get_asset_detail_results(kept_asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK

    def test_other_user_cannot_delete_others_assets(self):
        asset = self._add_one_asset_for_someuser()
        self._login_user('anotheruser')
        response = self._create_send_payload([asset.uid], 'delete')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure someuser still see their project
        self._login_user('someuser')
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_superuser_can_undelete(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        response = self._create_send_payload([asset.uid], 'delete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser cannot access their project anymore
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # superuser can undelete someuser's project
        self._login_superuser()
        response = self._create_send_payload([asset.uid], 'undelete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # someuser can access their project again
        self._login_user('someuser')
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True
        assert (
            detail_response.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_users_cannot_undelete(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        response = self._create_send_payload([asset.uid], 'delete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser cannot access their project anymore
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # someuser is not allowed to undelete their project
        response = self._create_send_payload([asset.uid], 'undelete')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser still cannot access their project
        detail_response = self._get_asset_detail_results(asset.uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND
