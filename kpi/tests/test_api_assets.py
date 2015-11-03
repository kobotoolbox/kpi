import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from lxml import etree
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.models import Asset
from kpi.models import Collection
from .kpi_test_case import KpiTestCase


class AssetsListApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_login_as_other_users(self):
        self.client.logout()
        self.client.login(username='someuser', password='someuser')
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        self.client.logout()

    def test_create_asset(self):
        """
        Ensure we can create a new asset
        """
        url = reverse('asset-list')
        data = {
            'content': json.dumps({}),
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        sa = Asset.objects.order_by('date_created').last()
        self.assertEqual(sa.content, {})


class AssetsDetailApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        url = reverse('asset-list')
        data = {'content': '{}'}
        self.r = self.client.post(url, data, format='json')
        self.asset_url = self.r.data['url']
        self.assertEqual(self.r.status_code, status.HTTP_201_CREATED)

    def test_asset_exists(self):
        resp = self.client.get(self.asset_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_can_update_asset_settings(self):
        data = {
            'settings': json.dumps({
                'mysetting': 'value'
            }),
        }
        resp = self.client.patch(self.asset_url, data, format='json')
        self.assertEqual(resp.data['settings'], {'mysetting': "value"})


class AssetsXmlExportApiTests(KpiTestCase):
    fixtures = ['test_data']

    def test_xml_export_title_retained(self):
        asset_title= 'XML Export Test Asset Title'
        content= {'settings': [{'form_title': asset_title, 'form_id': 'titled_asset'}],
                 'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('admin', 'pass')
        asset= self.create_asset('', json.dumps(content), format='json')
        response= self.client.get(reverse('asset-detail',
                                          kwargs={'uid':asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml= etree.fromstring(response.content)
        title_elts= xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertEqual(title_elts[0].text, asset_title)

    def test_xml_export_name_as_title(self):
        asset_name= 'XML Export Test Asset Name'
        content= {'settings': [{'form_id': 'named_asset'}],
                 'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('admin', 'pass')
        asset= self.create_asset(asset_name, json.dumps(content), format='json')
        response= self.client.get(reverse('asset-detail',
                                          kwargs={'uid':asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml= etree.fromstring(response.content)
        title_elts= xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertEqual(title_elts[0].text, asset_name)

    def test_xml_export_auto_title(self):
        content= {'settings': [{'form_id': 'no_title_asset'}],
                 'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('admin', 'pass')
        asset= self.create_asset('', json.dumps(content), format='json')
        response= self.client.get(reverse('asset-detail',
                                          kwargs={'uid':asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml= etree.fromstring(response.content)
        title_elts= xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertNotEqual(title_elts[0].text, '')


class ObjectRelationshipsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        self.user = User.objects.get(id=1)
        self.surv = Asset.objects.create(content={'survey': [{"type": "text", "name": "q1"}]},
                                         owner=self.user)
        self.coll = Collection.objects.create(name='sample collection', owner=self.user)

    def _count_children_by_kind(self, children, kind):
        count = 0
        # TODO: Request all pages of children
        for child in children['results']:
            if child['kind'] == kind:
                count += 1
        return count

    def test_list_asset(self):
        pass

    def test_collection_can_have_asset(self):
        '''
        * after assigning a asset, self.surv, to a collection (self.coll) [via the ORM]
            the asset is now listed in the collection's list of assets.
        '''
        _ = self.client.get(reverse('asset-detail', args=[self.surv.uid]))
        coll_req1 = self.client.get(reverse('collection-detail', args=[self.coll.uid]))
        self.assertEqual(self._count_children_by_kind(
            coll_req1.data['children'], self.surv.kind), 0)

        self.surv.parent = self.coll
        self.surv.save()

        surv_req2 = self.client.get(reverse('asset-detail', args=[self.surv.uid]))
        self.assertIn('parent', surv_req2.data)
        self.assertIn(self.coll.uid, surv_req2.data['parent'])

        coll_req2 = self.client.get(reverse('collection-detail', args=[self.coll.uid]))
        self.assertEqual(self._count_children_by_kind(
            coll_req2.data['children'], self.surv.kind), 1)
        self.assertEqual(
            self.surv.uid, coll_req2.data['children']['results'][0]['uid'])

    def test_add_asset_to_collection(self):
        '''
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        '''
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(
            surv_url, data={'parent': reverse('collection-detail', args=[self.coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/collections/%s' % (self.coll.uid), req.data['parent'])

    def test_remove_asset_from_collection(self):
        '''
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        * removing the collection assignment returns a HTTP 200 code.
        * a follow up query on the asset shows the collection unassigned
        '''
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(
            surv_url, data={'parent': reverse('collection-detail', args=[self.coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/collections/%s' % (self.coll.uid), req.data['parent'])
        # Assigned asset to collection successfully; now remove it
        patch_req = self.client.patch(surv_url, data={'parent': ''})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIsNone(req.data['parent'])

    def test_move_asset_between_collections(self):
        '''
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        * assigning a new collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows the new collection now set
        '''
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(surv_url, data={'parent': reverse(
            'collection-detail', args=[self.coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/collections/%s' % (self.coll.uid), req.data['parent'])
        # Assigned asset to collection successfully; now move it to another
        other_coll = Collection.objects.create(
            name='another collection', owner=self.user)
        patch_req = self.client.patch(surv_url, data={'parent': reverse(
            'collection-detail', args=[other_coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/collections/%s' % (other_coll.uid), req.data['parent'])
