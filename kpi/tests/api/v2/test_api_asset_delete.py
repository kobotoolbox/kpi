from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response

from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class AssetBulkDeleteAPITestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.url = reverse(self._get_endpoint('asset-bulk'))

    def _add_one_asset_for_someuser(self) -> Asset:
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
        )
        asset.deploy(backend='mock', active=True)
        return asset

    def _create_send_payload(self, asset_uids: list, action: str) -> Response:
        payload = {
            'payload': {
                'asset_uids': asset_uids,
                'action': action,
            }
        }
        response = self.client.post(self.url, data=payload, format='json')
        return response

    def _get_asset_detail_results(self, asset_uid: str) -> Response:
        asset_detail_url = reverse(self._get_endpoint('asset-detail'), args=(asset_uid,))
        detail_response = self.client.get(asset_detail_url, format='json')
        return detail_response

    def _login_superuser(self):
        self.client.logout()
        self.client.login(username='admin', password='pass')

    def _login_user(self, userpass: str):
        self.client.logout()
        self.client.login(username=userpass, password=userpass)

    def test_archive_own_assets(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        response = self._create_send_payload([asset_uid], 'archive')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is False

        # Ensure someuser still access the project and see it as archived
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is False

    def test_other_user_cannot_archive_others_assets(self):
        self._login_user('anotheruser')
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        response = self._create_send_payload([asset_uid], 'archive')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure someuser still access their project
        self._login_user('someuser')
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True

    def test_anonymous_archive_public(self):
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        anonymous = get_anonymous_user()
        asset.assign_perm(anonymous, PERM_VIEW_ASSET)
        self.client.logout()
        response = self._create_send_payload([asset_uid], 'archive')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Ensure anonymous user still access someuser's public project
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True

    def test_anonymous_delete_public(self):
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        anonymous = get_anonymous_user()
        asset.assign_perm(anonymous, PERM_VIEW_ASSET)
        self.client.logout()
        response = self._create_send_payload([asset_uid], 'delete')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure anonymous user still access someuser's public project
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True

    def test_delete_bulk_assets_for_one_user(self):
        self._login_user('someuser')
        asset_uids = []
        for i in range(3):
            asset = self._add_one_asset_for_someuser()
            asset_uids.append(asset.uid)
        response = self._create_send_payload(asset_uids, 'delete')
        assert response.status_code == status.HTTP_200_OK
        deleted_assets = Asset.all_objects.filter(uid__in=asset_uids)
        assert deleted_assets.count() == 3
        for deleted_asset in deleted_assets:
            assert deleted_asset.deployment.active is False
            assert deleted_asset.pending_delete is True
            detail_response = self._get_asset_detail_results(deleted_asset.uid)
            assert detail_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_own_assets(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        response = self._create_send_payload([asset_uid], 'delete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # Project is not accessible through API anymore
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

    def test_other_user_cannot_delete_others_assets(self):
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        self._login_user('anotheruser')
        response = self._create_send_payload([asset_uid], 'delete')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # Ensure someuser still see their project
        self._login_user('someuser')
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True

    def test_project_editor_cannot_archive_project(self):
        manager = User.objects.get(username='anotheruser')
        asset = Asset.objects.create(owner=User.objects.get(username='someuser'))
        asset.deploy(backend='mock', active=True)
        asset.assign_perm(manager, PERM_CHANGE_ASSET)
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

    def test_project_manager_can_archive_project(self):
        manager = User.objects.get(username='anotheruser')
        asset = Asset.objects.create(owner=User.objects.get(username='someuser'))
        asset.deploy(backend='mock', active=True)
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

    def test_superuser_can_undelete(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        response = self._create_send_payload([asset_uid], 'delete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser cannot access their project anymore
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # superuser can undelete someuser's project
        self._login_superuser()
        response = self._create_send_payload([asset_uid], 'undelete')
        assert response.status_code == status.HTTP_200_OK

        asset.refresh_from_db()
        assert asset.deployment.active is True
        assert asset.pending_delete is False

        # someuser can access their project again
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['deployment__active'] is True

    def test_users_cannot_undelete(self):
        self._login_user('someuser')
        asset = self._add_one_asset_for_someuser()
        asset_uid = asset.uid
        response = self._create_send_payload([asset_uid], 'delete')
        assert response.status_code == status.HTTP_200_OK

        asset = Asset.all_objects.get(uid=asset_uid)
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser cannot access their project anymore
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

        # someuser is not allowed to undelete their project
        response = self._create_send_payload([asset_uid], 'undelete')
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # someuser is not allowed to undelete their project
        asset.refresh_from_db()
        assert asset.deployment.active is False
        assert asset.pending_delete is True

        # someuser still cannot access their project
        detail_response = self._get_asset_detail_results(asset_uid)
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND
