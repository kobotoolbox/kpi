from django.conf import settings
from django.test import Client, TestCase
from model_bakery import baker

from hub.models.extra_user_detail import ExtraUserDetail

SESSION_URL = '/api/v2/allauth/browser/v1/auth/session'


class HeadlessSessionValidatedPasswordTestCase(TestCase):
    """
    `has_validated_password` moves the invalidated-password signal off `/me`, so
    the frontend can read every auth signal from the session endpoint
    """

    def setUp(self):
        self.client = Client()
        self.password = 'a-Sufficiently-Long-Passphrase-42'
        self.user = baker.make(settings.AUTH_USER_MODEL, username='someuser')
        self.user.set_password(self.password)
        self.user.save()

    def _session_user(self):
        response = self.client.get(SESSION_URL)
        assert response.status_code == 200, response.content
        return response.json()['data']['user']

    def _set_validated_password(self, validated):
        extra_details, _ = ExtraUserDetail.objects.get_or_create(user=self.user)
        extra_details.validated_password = validated
        extra_details.save(update_fields=['validated_password'])

    def test_true_for_an_ordinary_user(self):
        self.client.force_login(self.user)

        assert self._session_user()['has_validated_password'] is True

    def test_false_once_an_administrator_invalidates_the_password(self):
        self._set_validated_password(False)
        self.client.force_login(self.user)

        assert self._session_user()['has_validated_password'] is False

    def test_true_again_once_the_password_is_reset(self):
        self._set_validated_password(False)
        self._set_validated_password(True)
        self.client.force_login(self.user)

        assert self._session_user()['has_validated_password'] is True

    def test_is_independent_of_has_usable_password(self):
        # `has_usable_password` is False for every SSO account and says nothing
        # about whether an administrator restricted the account
        self.user.set_unusable_password()
        self.user.save()
        self.client.force_login(self.user)

        session_user = self._session_user()
        assert session_user['has_usable_password'] is False
        assert session_user['has_validated_password'] is True
