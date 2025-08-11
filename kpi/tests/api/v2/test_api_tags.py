from ddt import data, ddt, unpack
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
        assert response.data['results'][0]['name'] == self.tag.name

    def test_user_cannot_see_others(self):
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0
        assert response.data['results'] == []


@ddt
class TagDetailTestCase(BaseTagTestCase):

    def setUp(self):
        super().setUp()
        self.url = reverse(
            self._get_endpoint('tags-detail'), kwargs={'taguid__uid': self.tag_uid.uid}
        )

    @data(
        ('someuser',),
        ('anotheruser',),
        ('anonymous',),
    )
    @unpack
    def test_nobody_can_edit(self, username):
        if username != 'anonymous':
            self.client.force_login(User.objects.get(username=username))
        else:
            self.client.logout()

        response = self.client.post(self.url, data={'name': 'tag_edit'})
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    @data(
        ('someuser',),
        ('anotheruser',),
        ('anonymous',),
    )
    @unpack
    def test_nobody_can_delete(self, username):
        if username != 'anonymous':
            self.client.force_login(User.objects.get(username=username))
        else:
            self.client.logout()

        response = self.client.delete(self.url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_owner_can_see_their_own(self):
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == self.tag.name

    @data(
        ('anotheruser',),
        ('anonymous',),
    )
    @unpack
    def test_non_owner_cannot_see_tag(self, username):
        if username != 'anonymous':
            self.client.force_login(User.objects.get(username=username))
        else:
            self.client.logout()

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
