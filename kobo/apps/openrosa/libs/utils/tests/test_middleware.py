# coding: utf-8
from django.http import HttpResponseNotFound
from django.test import RequestFactory, TestCase

from kobo.apps.openrosa.libs.utils.middleware import (
    OpenRosaTrailingSlashMiddleware,
)


class OpenRosaTrailingSlashMiddlewareTests(TestCase):
    """
    DEV-1039: OpenRosa endpoints reject a trailing slash with an explicit 404
    instead of falling through to a misleading CSRF error.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = OpenRosaTrailingSlashMiddleware(lambda r: None)

    def _process(self, path):
        return self.middleware.process_request(self.factory.get(path))

    def test_trailing_slash_returns_404_for_every_variant(self):
        paths = [
            '/submission/',
            '/alice/submission/',
            '/collector/abc123/submission/',
            '/api/v2/asset_snapshots/sMFTYYe/submission/',
            '/formList/',
            '/alice/formList/',
            '/collector/abc123/formList/',
            '/api/v2/asset_snapshots/sMFTYYe/formList/',
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self._process(path)
                self.assertIsInstance(response, HttpResponseNotFound)
                body = response.content.decode()
                self.assertIn('do not accept a trailing slash', body)
                self.assertIn(path.rstrip('/'), body)

    def test_slashless_endpoints_pass_through(self):
        for path in ['/submission', '/alice/formList', '/alice/submission']:
            with self.subTest(path=path):
                self.assertIsNone(self._process(path))

    def test_similar_paths_not_matched(self):
        # bulk-submission and unrelated slashed URLs must not be intercepted
        for path in ['/alice/bulk-submission/', '/api/v2/assets/aXYZ/']:
            with self.subTest(path=path):
                self.assertIsNone(self._process(path))

    def test_non_openrosa_slashed_suffix_passes_through(self):
        # Suffix alone is not enough: the slash-less path must resolve to an
        # OpenRosa endpoint (guards against future /…/submission/ endpoints)
        for path in ['/api/v2/assets/aXYZ/submission/', '/foo/bar/formList/']:
            with self.subTest(path=path):
                self.assertIsNone(self._process(path))

    def test_double_trailing_slash_collapses_target(self):
        response = self._process('/submission//')
        self.assertIn('Retry the request at /submission', response.content.decode())
