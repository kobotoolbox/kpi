# coding: utf-8
from rest_framework.test import APITestCase


class BaseApiTestCase(APITestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
