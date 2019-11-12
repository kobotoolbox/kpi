# coding: utf-8
from django.test import TestCase
from django.contrib.auth.models import User


class UserDetailTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

    def test_user_automatically_has_extra_user_details(self):
        self.assertEqual(self.user.extra_details.data, {})

    def test_user_details_can_be_set(self):
        some_details = {
            'value1': 123,
            'value2': 456,
        }
        self.assertEqual(self.user.extra_details.data, {})
        self.user.extra_details.data = some_details
        self.user.extra_details.save()
        self.assertEqual(self.user.extra_details.data, some_details)

    def test_user_details_can_be_updated(self):
        some_details = {
            'value1': 'abc',
            'value2': False,
        }
        self.assertEqual(self.user.extra_details.data, {})
        self.user.extra_details.data.update(some_details)
        self.user.extra_details.save()
        self.assertEqual(self.user.extra_details.data, some_details)
