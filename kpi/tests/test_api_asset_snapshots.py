from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework import status

from ..models import AssetSnapshot
from .kpi_test_case import KpiTestCase


class TestAssetSnapshotList(KpiTestCase):
    fixtures = ['test_data']

    form_source = '''
                    {
                        "survey": [
                            {"type":"text","label":"Text+Question.","required":"true"},
                            {"name":"start","type":"start"},
                            {"name":"end","type":"end"}],
                        "settings": [
                            {"form_title":"New+form",
                            "form_id":"new_form"}]
                    }
                 '''

    def _create_asset_snapshot_from_source(self):
        self.client.login(username='someuser', password='someuser')
        url = reverse('assetsnapshot-list')

        data = {'source': self.form_source}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        xml_resp = self.client.get(response.data['xml'])
        self.assertTrue(len(xml_resp.content) > 0)
        self.client.logout()
        return response

    def test_create_asset_snapshot_from_source(self):
        self._create_asset_snapshot_from_source()

    def test_owner_can_access_snapshot_from_source(self):
        creation_response = self._create_asset_snapshot_from_source()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse('assetsnapshot-detail', args=(snapshot_uid,))
        self.client.login(username='someuser', password='someuser')
        detail_response = self.client.get(snapshot_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            creation_response.data['source'], detail_response.data['source'])

    def _create_asset_snapshot_from_asset(self):
        self.client.login(username='someuser', password='someuser')
        snapshot_list_url = reverse('assetsnapshot-list')
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json')
        asset_url = reverse('asset-detail', args=(asset.uid,))
        data = {'asset': asset_url}
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        xml_resp = self.client.get(response.data['xml'])
        self.assertTrue(len(xml_resp.content) > 0)
        self.client.logout()
        return response

    def test_create_asset_snapshot_from_asset(self):
        self._create_asset_snapshot_from_asset()

    def test_asset_owner_can_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse('assetsnapshot-detail', args=(snapshot_uid,))
        self.client.login(username='someuser', password='someuser')
        detail_response = self.client.get(snapshot_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            creation_response.data['source'], detail_response.data['source'])

    def test_other_user_cannot_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse('assetsnapshot-detail', args=(snapshot_uid,))
        self.client.login(username='anotheruser', password='anotheruser')
        detail_response = self.client.get(snapshot_url)
        self.assertTrue(detail_response.status_code in (
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ))

    def test_shared_user_can_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse('assetsnapshot-detail', args=(snapshot_uid,))
        asset = AssetSnapshot.objects.get(uid=snapshot_uid).asset
        another_user = User.objects.get(username='anotheruser')
        # Log in as the owner and share the asset
        self.client.login(username='someuser', password='someuser')
        self.add_perm(asset, another_user, 'view_')
        self.client.logout()
        # Log in as the user who was just granted permission
        self.client.login(username='anotheruser', password='anotheruser')
        detail_response = self.client.get(snapshot_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            creation_response.data['source'], detail_response.data['source'])

    def test_anon_can_access_snapshot_xml(self):
        # Behavior for Enketo integration; see
        # AssetSnapshotViewSet.get_queryset()
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse('assetsnapshot-detail', args=(snapshot_uid,))
        # Non-XML endpoints should not be public
        detail_response = self.client.get(snapshot_url)
        self.assertIn(detail_response.status_code, (
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ))
        # Test both DRF conventions of specifying the format
        snapshot_xml_urls = (
            snapshot_url.rstrip('/') + '.xml',
            snapshot_url + '?format=xml',
        )
        for xml_url in snapshot_xml_urls:
            detail_response = self.client.get(xml_url)
            self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
