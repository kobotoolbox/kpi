# coding: utf-8
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseApiTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.client.login(username='someuser', password='someuser')
