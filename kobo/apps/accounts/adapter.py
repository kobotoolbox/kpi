from allauth.account.adapter import DefaultAccountAdapter
from constance import config


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return config.REGISTRATION_OPEN
