# coding: utf-8
import re

from django.urls import reverse
from rest_framework import status

from kobo.apps.form_disclaimer.models import FormDisclaimer
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.languages.models.language import Language
from kpi.models.asset import AssetSnapshot
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.strings import to_str


class AssetSnapshotBase(KpiTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE
    form_source = """
        {
            "survey": [
                {"type":"text","label":"Text+Question.","required":"true"},
                {"name":"start","type":"start"},
                {"name":"end","type":"end"}],
            "settings": [
                {"form_title":"New+form",
                "form_id":"new_form"}]
        }
     """

    def _create_asset_snapshot_from_source(self):
        self.client.login(username='someuser', password='someuser')
        url = reverse(self._get_endpoint('assetsnapshot-list'))

        data = {'source': self.form_source}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        xml_resp = self.client.get(response.data['xml'])
        self.assertTrue(len(xml_resp.content) > 0)
        self.client.logout()
        return response


class TestAssetSnapshotList(AssetSnapshotBase):

    def test_create_asset_snapshot_from_source(self):
        self._create_asset_snapshot_from_source()

    def test_owner_can_access_snapshot_from_source(self):
        creation_response = self._create_asset_snapshot_from_source()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
        self.client.login(username='someuser', password='someuser')
        detail_response = self.client.get(snapshot_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            creation_response.data['source'], detail_response.data['source'])

    def _create_asset_snapshot_from_asset(self):
        self.client.login(username='someuser', password='someuser')
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json')
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
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

    def test_create_two_asset_snapshots_from_source_and_asset(self):
        """
        Make sure it's possible to preview unsaved changes to an asset multiple
        times; see https://github.com/kobotoolbox/kpi/issues/2058
        """
        self.client.login(username='someuser', password='someuser')
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json')
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'source': self.form_source, 'asset': asset_url}
        for _ in range(2):
            response = self.client.post(snapshot_list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                             msg=response.data)
            xml_resp = self.client.get(response.data['xml'])
            self.assertTrue(len(xml_resp.content) > 0)
        self.client.logout()

    def test_asset_owner_can_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
        self.client.login(username='someuser', password='someuser')
        detail_response = self.client.get(snapshot_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            creation_response.data['source'], detail_response.data['source'])

    def test_other_user_cannot_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
        self.client.login(username='anotheruser', password='anotheruser')
        detail_response = self.client.get(snapshot_url)
        self.assertTrue(detail_response.status_code in (
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ))

    def test_shared_user_can_access_snapshot(self):
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
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
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
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

    def test_head_requests_return_empty_responses(self):
        """
        HEAD requests sent to OpenRosa endpoints must return empty responses
        with 204 status codes and the appropriate headers set
        """
        VIEW_NAMES_TO_TEST = [
            'assetsnapshot-form-list',
            'assetsnapshot-manifest',
            'assetsnapshot-submission',
        ]
        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        self.client.login(username='someuser', password='someuser')
        for view_name in VIEW_NAMES_TO_TEST:
            url = reverse(self._get_endpoint(view_name), args=(snapshot_uid,))
            response = self.client.head(url)
            assert response.status_code == status.HTTP_204_NO_CONTENT
            assert not response.data
            assert 'X-OpenRosa-Accept-Content-Length' in response
            assert 'X-OpenRosa-Version' in response

    def test_xml_renderer(self):
        """
        Make sure the API endpoint returns the same XML as the ORM
        """
        def kludgy_is_xml_equal(*args):
            """
            Compare strings after removing newlines and whitespace between
            tags. Returns True if all strings are equal after this manipulation
            """
            xml_strings = list(args)
            for i, xml in enumerate(xml_strings):
                xml = to_str(xml).replace('\n', '')
                xml = re.sub(r'>\s+<', '><', xml)
                xml_strings[i] = xml

            return len(set(xml_strings)) == 1

        creation_response = self._create_asset_snapshot_from_asset()
        snapshot_uid = creation_response.data['uid']
        snapshot_url = reverse(self._get_endpoint('assetsnapshot-detail'), args=(snapshot_uid,))
        snapshot_orm_xml = AssetSnapshot.objects.get(uid=snapshot_uid).xml
        # Test both DRF conventions of specifying the format
        snapshot_xml_urls = (
            snapshot_url.rstrip('/') + '.xml',
            snapshot_url + '?format=xml',
        )
        for xml_url in snapshot_xml_urls:
            xml_response = self.client.get(xml_url)
            self.assertEqual(xml_response.status_code, status.HTTP_200_OK)
            self.assertTrue(
                kludgy_is_xml_equal(xml_response.content, snapshot_orm_xml)
            )


class TestAssetSnapshotDetail(AssetSnapshotBase):

    multilanguages_form_source = """
        {
            "survey": [
                {
                    "type": "text",
                    "label": ["Text+Question", "Texte+Question"],
                    "required": "true"
                },
                {
                    "name": "start",
                    "type": "start"
                },
                {
                    "name": "end",
                    "type": "end"
                }
            ],
            "settings": {"default_language": "English (en)"},
            "translated": ["label"],
            "translations": ["English (en)", "Francais (fr)"]
        }
    """

    def setUp(self) -> None:
        super().setUp()

        self.language_fr = Language.objects.create(code='fr', name='Français')
        self.language_en = Language.objects.create(code='en', name='English')
        FormDisclaimer.objects.create(
            language=self.language_en,
            default=True,
            message='Global message in English'
        )

    def test_preview_with_global_form_disclaimer(self):
        self.client.login(username='someuser', password='someuser')
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json'
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertContains(xml_response, 'Global message in English')

    def test_preview_with_overridden_form_disclaimer(self):
        self.client.login(username='someuser', password='someuser')
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json'
        )
        FormDisclaimer.objects.create(
            language=self.language_en,
            message='Overridden message in English',
            asset=asset,
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertContains(xml_response, 'Overridden message in English')
        self.assertNotContains(xml_response, 'Global message in English')

    def test_preview_with_hidden_global_form_disclaimer(self):
        self.client.login(username='someuser', password='someuser')
        asset = self.create_asset(
            'Take my snapshot!', self.form_source, format='json'
        )
        FormDisclaimer.objects.create(
            hidden=True,
            asset=asset,
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertNotContains(xml_response, 'Global message in English')
        self.assertNotContains(xml_response, '<input appearance="kobo-disclaimer"')

    def test_preview_with_multilanguages_form_and_global_disclaimer(self):
        self.client.login(username='someuser', password='someuser')
        asset = self.create_asset(
            'Take my snapshot!', self.multilanguages_form_source, format='json'
        )
        FormDisclaimer.objects.create(
            language=self.language_fr,
            message='Message global en français',
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertContains(xml_response, 'Global message in English')
        self.assertContains(xml_response, 'Message global en français')

    def test_preview_with_multilanguages_form_and_overridden_disclaimer(self):
        self.client.login(username='someuser', password='someuser')

        asset = self.create_asset(
            'Take my snapshot!', self.multilanguages_form_source, format='json'
        )
        FormDisclaimer.objects.create(
            language=self.language_en,
            message='Overridden message in English',
            asset=asset,
        )
        FormDisclaimer.objects.create(
            language=self.language_fr,
            message='Message remplacé en français',
            asset=asset,
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertNotContains(xml_response, 'Global message in English')
        self.assertNotContains(xml_response, 'Message global en français')
        self.assertContains(xml_response, 'Overridden message in English')
        self.assertContains(xml_response, 'Message remplacé en français')

    def test_preview_with_multilanguages_form_and_hidden_disclaimer(self):
        self.client.login(username='someuser', password='someuser')

        asset = self.create_asset(
            'Take my snapshot!', self.multilanguages_form_source, format='json'
        )
        FormDisclaimer.objects.create(
            hidden=True,
            asset=asset
        )
        asset_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        data = {'asset': asset_url}
        snapshot_list_url = reverse(self._get_endpoint('assetsnapshot-list'))
        response = self.client.post(snapshot_list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        snapshot_url = reverse(
            self._get_endpoint('assetsnapshot-xml-with-disclaimer'),
            kwargs={'uid': response.data['uid'], 'format': 'xml'}
        )
        xml_response = self.client.get(snapshot_url)
        self.assertNotContains(xml_response, 'Global message in English')
        self.assertNotContains(xml_response, 'Message global en français')
        self.assertNotContains(xml_response, 'Global message in English')
        self.assertNotContains(xml_response, '<input appearance="kobo-disclaimer"')
