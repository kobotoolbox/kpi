from django.shortcuts import reverse
from rest_framework.test import APITestCase


class StripeProductTestCase(APITestCase):
    def test_list(self):
        response = self.client.get(reverse('product-list'))
        self.assertEquals(response.status_code, 200)
