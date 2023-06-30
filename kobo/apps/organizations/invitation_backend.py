from django.contrib.auth.tokens import PasswordResetTokenGenerator
from organizations.backends.defaults import (
    InvitationBackend as BaseInvitationBackend,
)

from .models import Organization


class InvitationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        return str(user.pk) + str(timestamp)


class InvitationBackend(BaseInvitationBackend):
    """
    Based on django-organizations InvitationBackend but for org user instead of user
    """

    def __init__(self, org_model=None, namespace=None):
        self.user_model = None
        self.org_model = Organization
        self.namespace = namespace

    # TODO def get_urls(self):

    def get_token(self, org_user, **kwargs):
        return InvitationTokenGenerator().make_token(org_user)
