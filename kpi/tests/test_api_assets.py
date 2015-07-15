import json

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.models import Asset
from kpi.models import Collection


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
