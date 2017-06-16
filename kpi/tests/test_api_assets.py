import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from lxml import etree
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.models import Asset
from kpi.models import AssetVersion
from kpi.models import Collection
from .kpi_test_case import KpiTestCase
from formpack.utils.expand_content import SCHEMA_VERSION

EMPTY_SURVEY = {'survey': [], 'schema': SCHEMA_VERSION, 'settings': {}}


class AssetsListApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')

    def test_login_as_other_users(self):
        self.client.logout()
        self.client.login(username='admin', password='pass')
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        self.client.logout()

    def test_create_asset(self):
        """
        Ensure we can create a new asset
        """
        url = reverse('asset-list')
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        sa = Asset.objects.order_by('date_created').last()
        self.assertEqual(sa.content, EMPTY_SURVEY)
        return response

    def test_delete_asset(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        creation_response = self.test_create_asset()
        asset_url = creation_response.data['url']
        response = self.client.delete(asset_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK,
                         msg=response.data)


class AssetVersionApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = Asset.objects.first()
        self.asset.save()
        self.version = self.asset.asset_versions.first()
        self.version_list_url = reverse('asset-version-list',
                                        args=(self.asset.uid,))

    def test_asset_version(self):
        self.assertEqual(Asset.objects.count(), 1)
        self.assertEqual(AssetVersion.objects.count(), 1)
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 1)
        _version_detail_url = resp.data['results'][0].get('url')
        resp2 = self.client.get(_version_detail_url, format='json')
        self.assertTrue('survey' in resp2.data['content'])
        self.assertEqual(len(resp2.data['content']['survey']), 2)

    def test_restricted_access_to_version(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.data['count'], 0)
        _version_detail_url = reverse('asset-version-detail',
                                      args=(self.asset.uid, self.version.uid))
        resp2 = self.client.get(_version_detail_url)
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(resp2.data['detail'], 'Not found.')


class AssetsDetailApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        url = reverse('asset-list')
        data = {'content': '{}', 'asset_type': 'survey'}
        self.r = self.client.post(url, data, format='json')
        self.asset = Asset.objects.get(uid=self.r.data.get('uid'))
        self.asset_url = self.r.data['url']
        self.assertEqual(self.r.status_code, status.HTTP_201_CREATED)
        self.asset_uid = self.r.data['uid']

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

    def test_asset_has_deployment_data(self):
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('deployment__active'), False)
        self.assertEqual(response.data.get('has_deployment'), False)

    def test_asset_deployment_data_updates(self):
        deployment_url = reverse('asset-deployment',
                                 kwargs={'uid': self.asset_uid})

        response1 = self.client.post(deployment_url, {
                'backend': 'mock',
                'active': True,
            })
        asset = Asset.objects.get(uid=self.asset_uid)

        response2 = self.client.get(self.asset_url, format='json')
        self.assertEqual(response2.data.get('deployment__active'), True)
        self.assertEqual(response2.data['has_deployment'], True)

    def test_can_clone_asset(self):
        response = self.client.post(reverse('asset-list'),
                                    format='json',
                                    data={
                                       'clone_from': self.r.data.get('uid'),
                                       'name': 'clones_name',
                                    })
        self.assertEqual(response.status_code, 201)
        new_asset = Asset.objects.get(uid=response.data.get('uid'))
        self.assertEqual(new_asset.content, EMPTY_SURVEY)
        self.assertEqual(new_asset.name, 'clones_name')

    def test_can_clone_version_of_asset(self):
        v1_uid = self.asset.asset_versions.first().uid
        self.asset.content = {'survey': [{'type': 'note', 'label': 'v2'}]}
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)
        v2_uid = self.asset.asset_versions.first().uid
        self.assertNotEqual(v1_uid, v2_uid)

        self.asset.content = {'survey': [{'type': 'note', 'label': 'v3'}]}
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 3)
        response = self.client.post(reverse('asset-list'),
                                    format='json',
                                    data={
                                       'clone_from_version_id': v2_uid,
                                       'clone_from': self.r.data.get('uid'),
                                       'name': 'clones_name',
                                    })

        self.assertEqual(response.status_code, 201)
        new_asset = Asset.objects.get(uid=response.data.get('uid'))
        self.assertEqual(new_asset.content['survey'][0]['label'], ['v2'])
        self.assertEqual(new_asset.content['translations'], [None])

    def test_deployed_version_pagination(self):
        PAGE_LENGTH = 100
        version = self.asset.latest_version
        preexisting_count = self.asset.deployed_versions.count()
        version.deployed = True
        for i in range(PAGE_LENGTH + 11):
            version.uid = ''
            version.pk = None
            version.save()
        self.assertEqual(
            preexisting_count + PAGE_LENGTH + 11,
            self.asset.deployed_versions.count()
        )
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(
            response.data['deployed_versions']['count'],
            self.asset.deployed_versions.count()
        )
        self.assertEqual(
            len(response.data['deployed_versions']['results']),
            PAGE_LENGTH
        )


class AssetsXmlExportApiTests(KpiTestCase):
    fixtures = ['test_data']

    def test_xml_export_title_retained(self):
        asset_title= 'XML Export Test Asset Title'
        content= {'settings': [{'id_string': 'titled_asset'}],
                 'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset= self.create_asset(asset_title, json.dumps(content), format='json')
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
        self.login('someuser', 'someuser')
        asset= self.create_asset(asset_name, json.dumps(content), format='json')
        response= self.client.get(reverse('asset-detail',
                                          kwargs={'uid':asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml= etree.fromstring(response.content)
        title_elts= xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertEqual(title_elts[0].text, asset_name)

    def test_api_xml_export_auto_title(self):
        content = {'settings': [{'form_id': 'no_title_asset'}],
                   'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset = self.create_asset('', json.dumps(content), format='json')
        response = self.client.get(reverse('asset-detail',
                                           kwargs={'uid': asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml = etree.fromstring(response.content)
        title_elts = xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertNotEqual(title_elts[0].text, '')

    def test_xml_export_group(self):
        example_formbuilder_output= {'survey': [{"type": "begin_group",
                                                 "relevant": "",
                                                 "appearance": "",
                                                 "name": "group_hl3hw45",
                                                 "label": "Group 1 Label"},
                                                {"required": "true",
                                                 "type": "decimal",
                                                 "label": "Question 1 Label"},
                                                {"type": "end_group"}],
                                     "settings": [{"form_title": "",
                                                   "form_id": "group_form"}]}

        self.login('someuser', 'someuser')
        asset= self.create_asset('', json.dumps(example_formbuilder_output), format='json')
        response= self.client.get(reverse('asset-detail',
                                          kwargs={'uid':asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml= etree.fromstring(response.content)
        group_elts= xml.xpath('./*[local-name()="body"]/*[local-name()="group"]')
        self.assertEqual(len(group_elts), 1)
        self.assertNotIn('relevant', group_elts[0].attrib)


class ObjectRelationshipsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.surv = Asset.objects.create(content={'survey': [{"type": "text", "name": "q1"}]},
                                         owner=self.user,
                                         asset_type='survey')
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


class AssetsSettingsFieldTest(KpiTestCase):
    fixtures = ['test_data']

    def test_query_settings(self):
        asset_title = 'asset_title'
        content = {'settings': [{'id_string': 'titled_asset'}],
                 'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset = self.create_asset(None, json.dumps(content), format='json')
        self.assert_object_in_object_list(asset)
        # Note: This is not an API method, but an ORM one.
        self.assertFalse(Asset.objects.filter(settings__id_string='titled_asset'))
