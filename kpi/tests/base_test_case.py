# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework.test import APITestCase


class BaseTestCase(APITestCase):

    URL_NAMESPACE = None

    def _get_endpoint(self, endpoint):
        if hasattr(self, 'URL_NAMESPACE') and self.URL_NAMESPACE is not None:
            endpoint = '{}:{}'.format(self.URL_NAMESPACE, endpoint) \
                if self.URL_NAMESPACE else endpoint
        return endpoint
