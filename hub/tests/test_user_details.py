from django.test import TestCase
from django.contrib.auth.models import User

from hub.models import ExtraUserDetail

class AssetsTestCase(TestCase):
    fixtures = ['test_data']

    def test_user_automatically_has_extra_user_details(self):
        user = User.objects.last()
        self.assertEqual(user.extra_details.data, {})

    def test_user_details_can_be_set(self):
        user = User.objects.last()
        some_details = {
            'value1': 123,
            'value2': 456,
        }
        self.assertEqual(user.extra_details.data, {})
        user.extra_details.data = some_details
        user.extra_details.save()
        self.assertEqual(User.objects.last().extra_details.data, some_details)

    def test_user_details_can_be_updated(self):
        user = User.objects.last()
        some_details = {
            'value1': 'abc',
            'value2': False,
        }
        self.assertEqual(user.extra_details.data, {})
        user.extra_details.data.update(some_details)
        user.extra_details.save()
        self.assertEqual(User.objects.last().extra_details.data, some_details)
