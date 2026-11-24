from django.core.exceptions import PermissionDenied
from django.http import HttpRequest

from kobo.apps.accounts.adapter import AccountAdapter

TEST_CLIENT_IP = 'Not.A.Real.Ip'


class TestAdapter(AccountAdapter):
    # don't raise an error if a test request doesn't have ip-related headers
    def get_client_ip(self, request: HttpRequest) -> str:
        try:
            return super().get_client_ip(request)
        except PermissionDenied:
            return TEST_CLIENT_IP
