from django.urls import reverse
from rest_framework import status
from taggit.models import Tag

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset, TagUid
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseTagTestCase(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = Asset.objects.create(owner=User.objects.get(username='someuser'))
        self.tag = Tag.objects.create(name='tag_creation')
        self.asset.tags.add(self.tag)
        self.tag_uid, _ = TagUid.objects.get_or_create(tag=self.tag)
        self.url = reverse(self._get_endpoint('tags-list'))


class TagListTestCase(BaseTagTestCase):

    def test_only_owner_can_see_their_own(self):
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        result = response.data['results'][0]
        assert result['name'] == self.tag.name
        assert result['uid'] == self.tag_uid.uid

    def test_user_cannot_see_others(self):
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0
        assert response.data['results'] == []

    def test_tag_on_multiple_assets(self):
        # Previously was failing due to lack of `distinct()` on queryset with
        # permission joins
        second_asset = Asset.objects.create(
            owner=User.objects.get(username='someuser')
        )
        second_asset.tags.add(self.tag)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        names = [r['name'] for r in response.data['results']]
        assert names.count(self.tag.name) == 1
