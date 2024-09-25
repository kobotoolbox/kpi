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

    def test_get_client_ip(self):
        request = RequestFactory().get('/')
        client_ip = get_client_ip(request)
        self.assertIsNotNone(client_ip)
        # will this always be 127.0.0.1
        self.assertEqual(client_ip, '127.0.0.1')

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
