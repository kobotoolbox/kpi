from kpi.tests.base_test_case import BaseAssetDetailTestCase


class RendererNegotiationTests(BaseAssetDetailTestCase):
    """
    Validate renderer/content negotiation behavior for a specific endpoint.

    Expectations:
      - When Accept='*/*' and no explicit format: returns JSON.
      - When Accept='text/html' and no explicit format: returns HTML.
      - When explicit format is provided (json or xml): returns that format.
    """

    def setUp(self):
        super().setUp()
        self.data_url = self.r.data['data']

    def test_accept_any_defaults_to_json(self):
        resp = self.client.get(self.data_url, HTTP_ACCEPT='*/*')
        assert self._is_json(
            resp['Content-Type']
        ), f'Expected JSON, got {resp["Content-Type"]}'

    def test_accept_html_returns_html_when_no_format(self):
        resp = self.client.get(self.data_url, HTTP_ACCEPT='text/html')
        assert self._is_html(
            resp['Content-Type']
        ), f'Expected HTML, got {resp["Content-Type"]}'

    def test_explicit_format_json_via_query_param(self):
        resp = self.client.get(self.data_url, {'format': 'json'})
        assert self._is_json(
            resp['Content-Type']
        ), f'Expected JSON, got {resp["Content-Type"]}'

    def test_explicit_format_xml_via_query_param(self):
        resp = self.client.get(self.data_url, {'format': 'xml'})
        assert self._is_xml(
            resp['Content-Type']
        ), f'Expected XML, got {resp["Content-Type"]}'
        assert resp.content.strip().startswith(
            b'<'
        ), 'Expected XML payload to start with "<"'

    def test_explicit_format_json_via_suffix(self):
        url = self.data_url.rstrip('/') + '.json'
        resp = self.client.get(url)
        assert self._is_json(
            resp['Content-Type']
        ), f'Expected JSON, got {resp["Content-Type"]}'

    def test_explicit_format_xml_via_suffix(self):
        url = self.data_url.rstrip('/') + '.xml'
        resp = self.client.get(url)
        assert self._is_xml(
            resp['Content-Type']
        ), f'Expected XML, got {resp["Content-Type"]}'
        assert resp.content.strip().startswith(
            b'<'
        ), 'Expected XML payload to start with "<"'

    def _is_json(self, content_type: str) -> bool:
        return content_type.startswith('application/json')

    def _is_html(self, content_type: str) -> bool:
        return content_type.startswith('text/html')

    def _is_xml(self, content_type: str) -> bool:
        return content_type.startswith('application/xml') or content_type.startswith(
            'text/xml'
        )
