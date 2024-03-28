# coding: utf-8
import pytest
from django.conf import settings
from django.urls import reverse

from .test_base import TestBase


class TestFormAuth(TestBase):

    def setUp(self):
        TestBase.setUp(self)

    @pytest.mark.skip('Login is handled by KPI')
    def test_home_redirects(self):
        self._create_user_and_login(username='bob', password='bob')
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 302)
        received, desired = (
            u.rstrip('/') for u in (response['Location'], settings.KOBOFORM_URL)
        )
        assert received == desired

    @pytest.mark.skip('Login is handled by KPI')
    def test_profile_redirects(self):
        self._create_user_and_login(username='bob', password='bob')
        url = reverse('user_profile', kwargs={'username': self.user.username})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        received, desired = (
            u.rstrip('/') for u in (response['Location'], settings.KOBOFORM_URL)
        )
        assert received == desired
