from ddt import data, ddt, unpack
from django.urls import reverse
from rest_framework import status

from hub.models import SitewideMessage
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


@ddt
class TermsOfServiceAPITestCase(BaseTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE
    fixtures = ['test_data']

    def setUp(self):
        self.list_url = reverse(self._get_endpoint('terms-of-service-list'))
        self.detail_url = reverse(
            self._get_endpoint('terms-of-service-detail'),
            kwargs={'slug': 'terms_of_service'},
        )
        SitewideMessage.objects.bulk_create(
            [
                SitewideMessage(
                    slug='terms_of_service', body='Default terms of service'
                ),
                SitewideMessage(
                    slug='terms_of_service_fr', body="Conditions d'utilisation"
                ),
            ]
        )


    @data(
        ('adminuser', status.HTTP_200_OK),
        ('someuser', status.HTTP_200_OK),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_list_access(self, username, status_code):
        if username != 'anonymous':
            self.client.force_login(user=User.objects.get(username=username))

        response = self.client.get(self.list_url)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            response_slugs = [message['slug'] for message in response.data]
            assert response_slugs == ['terms_of_service', 'terms_of_service_fr']

    @data(
        ('adminuser', status.HTTP_200_OK),
        ('someuser', status.HTTP_200_OK),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_detail_access(self, username, status_code):
        if username != 'anonymous':
            self.client.force_login(user=User.objects.get(username=username))
        response = self.client.get(self.detail_url)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            assert response.data == {
                'url': self.absolute_reverse(
                    self._get_endpoint('terms-of-service-detail'),
                    kwargs={'slug': 'terms_of_service'}
                ),
                'slug': 'terms_of_service',
                'body': 'Default terms of service',
            }

    @data(
        ('adminuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('someuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_cannot_create(self, username, status_code):
        if username != 'anonymous':
            self.client.force_login(user=User.objects.get(username=username))
        response = self.client.post(
            self.list_url, data={'slug': 'foo', 'body': 'bar'}
        )
        assert response.status_code == status_code

    @data(
        ('adminuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('someuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_cannot_update(self, username, status_code):
        if username != 'anonymous':
            self.client.force_login(user=User.objects.get(username=username))
        response = self.client.post(self.detail_url, data={'body': 'bar'})
        assert response.status_code == status_code

    @data(
        ('adminuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('someuser', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_cannot_delete(self, username, status_code):
        if username != 'anonymous':
            self.client.force_login(user=User.objects.get(username=username))
        response = self.client.delete(self.detail_url)
        assert response.status_code == status_code
