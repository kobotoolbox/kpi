from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
from django.test import TestCase
import json

class SurveyAssetsListApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_login_as_other_users(self):
        self.client.logout()
        self.client.login(username='someuser', password='someuser')
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        self.client.logout()

    def test_create_survey_asset(self):
        """
        Ensure we can create a new survey asset
        """
        url = reverse('surveyasset-list')
        data = {
            'content': json.dumps([]),
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                            msg=response.data)
        sa = SurveyAsset.objects.last()
        self.assertEqual(sa.content, [])

class SurveyAssetsDetailApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        url = reverse('surveyasset-list')
        data = {'content': '[]'}
        self.r = self.client.post(url, data, format='json')
        self.asset_url = self.r.data['url']
        self.assertEqual(self.r.status_code, status.HTTP_201_CREATED)

    def test_survey_asset_exists(self):
        resp = self.client.get(self.asset_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_can_update_survey_asset_settings(self):
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
        self.surv = SurveyAsset.objects.create(content='[{"type":"text","name":"q1"}]', owner=self.user)
        self.coll = Collection.objects.create(name='sample collection', owner=self.user)

    def test_list_survey_asset(self):
        pass

    def test_collection_can_have_survey_asset(self):
        '''
        * after assigning a survey asset, self.surv, to a collection (self.coll) [via the ORM]
            the survey asset is now listed in the collection's list of assets.
        '''
        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.uid]))
        coll_req1 = self.client.get(reverse('collection-detail', args=[self.coll.uid]))
        self.assertEqual(len(coll_req1.data['survey_assets']), 0)

        self.surv.parent = self.coll
        self.surv.save()

        surv_req2 = self.client.get(reverse('surveyasset-detail', args=[self.surv.uid]))
        self.assertIn('parent', surv_req2.data)
        self.assertIn(self.coll.uid, surv_req2.data['parent'])

        coll_req2 = self.client.get(reverse('collection-detail', args=[self.coll.uid]))
        self.assertEqual(len(coll_req2.data['survey_assets']), 1)
        self.assertIn(self.surv.uid, coll_req2.data['survey_assets'][0])

    def test_add_survey_asset_to_collection(self):
        '''
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        '''
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('surveyasset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(surv_url, data={'parent': reverse('collection-detail', args=[self.coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/collections/%s' % (self.coll.uid), req.data['parent'])
