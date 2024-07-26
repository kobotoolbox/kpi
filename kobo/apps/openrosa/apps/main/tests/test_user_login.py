# coding: utf-8
import pytest
from .test_base import TestBase


class TestUserLogin(TestBase):

    def test_any_case_login_ok(self):
        username = 'bob'
        password = 'bobbob'
        # kobocat lo
        self._create_user(username, password)
        # kobocat login are now case sensitive so you must lowercase BOB
        self._login('bob', password)

    @pytest.mark.skip(reason='Login is handled by KPI')
    def test_redirect_if_logged_in(self):
        self._create_user_and_login()
        response = self.client.get('')
        self.assertEqual(response.status_code, 302)
