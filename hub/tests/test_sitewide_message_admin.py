from constance import config
from constance.test import override_config
from django.contrib.admin import site
from django.contrib.messages import get_messages
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from hub.admin import SitewideMessageAdmin
from hub.models import SitewideMessage


class SitewideMessageAdminTest(TestCase):
    @override_config(LAST_TOS_UPDATE='')
    def test_require_reacceptance_with_no_tos_message(self):
        admin_instance = SitewideMessageAdmin(SitewideMessage, site)
        request = self.client.request().wsgi_request
        admin_instance.require_terms_of_service_reacceptance(
            request, SitewideMessage.objects.none()
        )
        messages_list = [m.message for m in get_messages(request)]
        expected_message = (
            'Add a SitewideMessage with the slug terms_of_service '
            'before requiring reacceptance'
        )
        assert expected_message in messages_list
        assert config.LAST_TOS_UPDATE == ''

    def test_require_reacceptance_with_tos_message(self):
        SitewideMessage.objects.create(slug='terms_of_service')
        admin_instance = SitewideMessageAdmin(SitewideMessage, site)
        request = self.client.request().wsgi_request
        now = timezone.now()
        with freeze_time(now):
            admin_instance.require_terms_of_service_reacceptance(
                request, SitewideMessage.objects.none()
            )
        messages_list = [m.message for m in get_messages(request)]
        expected_message = (
            'All users will be prompted to re-accept' ' the Terms of Service'
        )
        assert expected_message in messages_list
        assert config.LAST_TOS_UPDATE == now.strftime('%Y-%m-%dT%H:%M:%SZ')
