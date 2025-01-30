from allauth.account.models import EmailAddress
from django.core.management import call_command
from django.test import TestCase

from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile

from .models import User


class KoboAuthTestCase(TestCase):
    def test_createsuperuser(self):
        call_command(
            'createsuperuser',
            interactive=False,
            username='admin',
            email='admin@example.com',
        )
        self.assertTrue(User.objects.exists())
        self.assertTrue(UserProfile.objects.exists())
        self.assertTrue(EmailAddress.objects.exists())
