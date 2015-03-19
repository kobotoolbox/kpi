from __future__ import absolute_import
import re

from django.core.urlresolvers import reverse
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from ..models.collection import Collection
from ..models.survey_asset import SurveyAsset

class Test(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.someuser= User.objects.get(username='someuser')
        self.admin_collection= Collection.objects.create(owner=self.admin)
        self.admin_asset= SurveyAsset.objects.get(name='fixture admin asset')

    def test_viewable_assets_in_asset_list(self):
        return # FIXME
        # Log in as "admin" and give "someuser" view permission.
        self.client.login(username='admin', password='pass')
        perm_url= reverse('surveyasset-permission',
                          kwargs={'uid': self.admin_asset.uid})
        response= self.client.get(perm_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        permissions= response.data['results']
        self.assertNotIn('view_surveyasset', permissions[self.someuser['username']])
        permissions[self.someuser['username']].append('view_surveyasset')
        response= self.client.patch(data=permissions)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Log in as "someuser" and check the effect of the permission change.
        self.client.login(username='someuser', password='ask John for password')
        url= reverse('collection_list')
        response= self.client.get(url)
        uid_found= False
        for rslt in response.data['results']:
            uid= re.match(r'.+/(.+)/$', rslt['url']).groups()[0]
            if uid == self.admin_asset.uid:
                uid_found= True
                break
        self.assertTrue(uid_found)


    def test_viewable_collections_in_collection_list(self):
        return # FIXME
