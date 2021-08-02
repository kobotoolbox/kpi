# coding: utf-8
from django.contrib.auth.models import User, AnonymousUser
from django.urls import reverse
from django.test import TestCase

from hub.models import PerUserSetting
from kpi.utils.strings import to_str


class PerUserSettingTestCase(TestCase):

    def setUp(self):
        self.user_for_username_match = User.objects.create(
            username='match_me')
        self.user_for_email_match = User.objects.create(
            username='no_match_here',
            email='foundme@matchthis.int',
        )
        self.non_matching_user = User.objects.create(username='leave_me_alone')
        self.setting = PerUserSetting.objects.create(
            name='test',
            user_queries=[{'username__icontains': 'Match'},
                          {'email__iendswith': 'MatchThis.int'}],
            value_when_matched='great!',
            value_when_not_matched='okay...',
        )

    def test_matching_user(self):
        for u in [self.user_for_username_match, self.user_for_email_match]:
            self.assertTrue(self.setting.user_matches(u))
            self.assertEqual(self.setting.get_for_user(u), 'great!')

    def test_non_matching_user(self):
        u = self.non_matching_user
        self.assertFalse(self.setting.user_matches(u))
        self.assertEqual(self.setting.get_for_user(u), 'okay...')

    def test_anonymous_user(self):
        u = AnonymousUser()
        self.assertFalse(self.setting.user_matches(u))
        self.assertEqual(self.setting.get_for_user(u), 'okay...')

    def test_invalid_queries(self):
        setting = PerUserSetting()
        setting.name = 'bogus'
        setting.user_queries = ['not a dictionary']
        self.assertFalse(setting.user_matches(self.non_matching_user))
        setting.user_queries = [{'not_a_real_field': 'impossible value'}]
        self.assertFalse(setting.user_matches(self.non_matching_user))


class IntercomConfigurationTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.setting = PerUserSetting.objects.create(
            name='INTERCOM_APP_ID',
            user_queries=[{"username": "someuser"}],
            value_when_matched='arm&leg',
            value_when_not_matched='',
        )

    def test_intercom_for_matching_user(self):
        self.assertTrue(self.client.login(username='someuser',
                                          password='someuser'))
        response = self.client.get(reverse('kpi-root'))
        lines = [line.strip() for line in to_str(response.content).split('\n')]
        self.assertTrue("window.IntercomAppId = 'arm&leg';" in lines)

    def test_no_intercom_for_non_matching_user(self):
        self.assertTrue(self.client.login(username='anotheruser',
                                          password='anotheruser'))
        response = self.client.get(reverse('kpi-root'))
        lines = [line.strip() for line in to_str(response.content).split('\n')]
        self.assertFalse("window.IntercomAppId = 'arm&leg';" in lines)
