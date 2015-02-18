from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from kpi.models import SurveyAsset
from kpi.models import SurveyAssetRevision
from kpi.models import Collection
from django.contrib.auth.models import User

from kpi.xlsform import InMemoryXlsform

from django.test import TestCase
import reversion

class SurveyAssetsTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.sample_inmemory_xlsform = InMemoryXlsform([
                {'type': 'text', 'label': 'Question 1', 'name': 'q1'},
                {'type': 'text', 'label': 'Quesiton 2', 'name': 'q2'},
            ])

    def test_create_survey_asset(self):
        xlf_body = self.sample_inmemory_xlsform.to_ss_json()
        survey_asset = SurveyAsset.objects.create(body=xlf_body, owner=User.objects.all()[0])
        self.assertEqual(survey_asset.versions().count(), 1)
        survey_asset.update_asset_type('text')
        self.assertEqual(survey_asset.body, '{"survey": [{"type": "text", "name": "q1", "label": "Question 1"}, {"type": "text", "name": "q2", "label": "Quesiton 2"}]}')
        self.assertEqual(survey_asset.versions().count(), 2)
        sv0 = survey_asset.versions()[0]
        sv1 = survey_asset.versions()[1]
        v_uid1 = (sv0.field_dict['uid'], sv0.field_dict['revision_uid'],)
        v_uid2 = (sv1.field_dict['uid'], sv1.field_dict['revision_uid'],)
        self.assertEqual(SurveyAssetRevision.objects.filter(asset_uid=v_uid1[0], version_uid=v_uid1[1]).count(), 1)
        self.assertEqual(SurveyAssetRevision.objects.filter(asset_uid=v_uid2[0], version_uid=v_uid2[1]).count(), 1)
        self.assertNotEqual('@'.join(v_uid1), '@'.join(v_uid2))
        # self.assertEqual(survey_asset.versions().first().field_dict['asset_type'], 'block')
        # self.assertEqual(survey_asset.versions().last().field_dict['asset_type'], 'text')

class SurveyAssetsApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        self.sample_inmemory_xlsform = InMemoryXlsform([
                {'type': 'text', 'label': 'Question 1', 'name': 'q1'},
                {'type': 'text', 'label': 'Quesiton 2', 'name': 'q2'},
            ])

    def test_create_survey_asset(self):
        """
        Ensure we can create a new account object.
        """
        url = reverse('surveyasset-list')
        data = {'body': 'print 123'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['body'], 'print 123')

    def test_inmemory_xlsform(self):
        data = self.sample_inmemory_xlsform._req_data()
        response = self.client.post(reverse('surveyasset-list'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['settings'], None)
        created_xlsform = InMemoryXlsform._parse_req(response.data)
        self.assertEqual(len(created_xlsform._rows), 2)
        self.assertEqual(created_xlsform._rows[0]['type'], 'text')


class CollectionsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_create_collection(self):
        """
        Ensure we can create a new collection object.
        """
        url = reverse('collection-list')
        data = {'name': 'my collection', 'collections': [], 'survey_assets': []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'my collection')

class ObjectRelationshipsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        self.user = User.objects.get(id=1)
        self.surv = SurveyAsset.objects.create(body='print type({})', owner=self.user)
        self.fold = Collection.objects.create(name='sample collection', owner=self.user)

    def test_list_survey_asset(self):
        req = self.client.get(reverse('surveyasset-list'))
        self.assertEqual(req.data['results'][0]['body'], 'print type({})')

        req = self.client.get(reverse('collection-list'))
        self.assertEqual(req.data['results'][0]['name'], 'sample collection')

    def test_collection_can_have_survey_asset(self):
        # req = self.client.get(reverse('surveyasset-detail'))
        self.surv.collection = self.fold
        self.surv.save()

        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.id]))
        self.assertTrue('collection' in req.data)
        self.assertEqual(req.data['collectionName'], 'sample collection')

        req2 = self.client.get(reverse('collection-detail', args=[self.fold.id]))
        self.assertEqual(len(req2.data['survey_assets']), 1)

    def test_add_survey_asset_to_collection(self):
        self.assertEqual(self.surv.collection, None)
        surv_url = reverse('surveyasset-detail', args=[self.surv.id])
        patch_req = self.client.patch(surv_url, data={'collection': self.fold.id})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        # print req.data
        # self.assertEqual(req.data['results'][0]['name'], 'sample collection')
