# coding: utf-8
from ddt import data, ddt, unpack
from django.test.client import RequestFactory

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.viewer_tools import (
    export_def_from_filename,
    get_client_ip,
    get_human_readable_client_user_agent,
)


@ddt
class TestViewerTools(TestBase):
    def test_export_def_from_filename(self):
        filename = 'path/filename.xlsx'
        ext, mime_type = export_def_from_filename(filename)
        self.assertEqual(ext, 'xlsx')
        self.assertEqual(mime_type, 'vnd.openxmlformats')

    @data(
        # chrome on android phone
        (
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            ' (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
            'Chrome Mobile (Android)',
        ),
        # chrome on Windows
        (
            'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko)'
            ' Chrome/47.0.2526.111 Safari/537.36',
            'Chrome (Windows)',
        ),
        # firefox on linux
        (
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
            'Firefox (Ubuntu)',
        ),
        # curl
        ('curl/7.88.1', 'curl (Other)'),
        # system browser on iPhone
        (
            'Mozilla/5.0 (Apple-iPhone7C2/1202.466; U; CPU like Mac OS X; en) AppleWebKit/420+'
            ' (KHTML, like Gecko) Version/3.0 Mobile/1A543 Safari/419.3',
            'Mobile Safari (iOS)',
        ),
        # ODK Collect on Android
        (
            'org.odk.collect.android/v2023.2.3 Dalvik/2.1.0'
            ' (Linux; U; Android 11; moto g pure Build/RRH31.Q3-46-50-2)',
            'ODK Collect v2023.2.3 (Android 11)',
        ),
        # Kobo Collect on Android
        (
            'org.koboc.collect.android/v2023.2.3 Dalvik/2.1.0'
            ' (Linux; U; Android 11; moto g pure Build/RRH31.Q3-46-50-2)',
            'Kobo Collect v2023.2.3 (Android 11)',
        ),
        # Enketo with build suffix in version (only semver kept)
        (
            'Enketo/7.5.1-30-g743d112f Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            'Chrome - Enketo 7.5.1 (Mac OS X)',
        ),
        # nonsense
        ('Lizards!', 'Other (Other)'),
        # empty
        ('', 'No information available'),
        # missing
        (None, 'No information available'),
    )
    @unpack
    def test_client_user_agent(self, ua_string, expected_result):
        factory = RequestFactory()
        header = {'HTTP_USER_AGENT': ua_string}
        request = factory.get('/', **header)
        result = get_human_readable_client_user_agent(request)
        self.assertEqual(result, expected_result)

    # tests added in case allauth changes how it determines client ips
    def test_client_ip_favors_xff_header(self):
        factory = RequestFactory()
        request = factory.get(
            '/', **{'HTTP_X_FORWARDED_FOR': '1.2.3.4', 'REMOTE_ADDR': '5.6.7.8'}
        )
        assert get_client_ip(request) == '1.2.3.4'

    def test_client_ip_defaults_to_remote_addr(self):
        factory = RequestFactory()
        request = factory.get('/', **{'REMOTE_ADDR': '1.2.3.4'})
        request.META.pop('HTTP_X_FORWARDED_FOR', None)
        assert get_client_ip(request) == '1.2.3.4'
