from unittest import mock

from constance.test import override_config
from django.db.utils import OperationalError
from django.test import Client, RequestFactory, TestCase, override_settings
from django.urls import path

import kobo.urls
from hub.models import ConfigurationFile
from hub.models.configuration_file import ConfigurationFileSlug
from kpi.views.error_pages import dev_error_page_preview


def crashing_view(request):
    raise OperationalError('connection to server failed')


# The real URLconf plus one route that always crashes, so `handler500` can be
# exercised. The handlers themselves are the real ones from `kobo/urls.py`
urlpatterns = [path('__crash__/', crashing_view)] + kobo.urls.urlpatterns
handler404 = kobo.urls.handler404
handler500 = kobo.urls.handler500

HTML = {'HTTP_ACCEPT': 'text/html'}
JSON = {'HTTP_ACCEPT': 'application/json'}


# `DEBUG` must be off, otherwise Django serves its own technical error pages
# and never calls our handlers
@override_settings(DEBUG=False, ROOT_URLCONF=__name__)
class ErrorPageHandlersTestCase(TestCase):

    def setUp(self):
        # Without this, the test client re-raises the view's exception instead
        # of returning the 500 response the user would get.
        self.client = Client(raise_request_exception=False)

    def assert_error_app_page(self, response, error_code):
        self.assertEqual(response.status_code, error_code)
        self.assertTemplateUsed(response, 'error_page.html')
        self.assertContains(
            response, f'data-error-code="{error_code}"', status_code=error_code
        )

    def test_404_html_request_serves_error_app(self):
        response = self.client.get('/accounts/blahblah/', **HTML)
        self.assert_error_app_page(response, 404)
        # The no-JS fallback copy
        self.assertContains(response, 'Page not found (404)', status_code=404)

    def test_404_data_request_serves_plain_text(self):
        response = self.client.get('/accounts/blahblah/', **JSON)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b'Resource not found (404)')
        self.assertTemplateNotUsed(response, 'error_page.html')

    def test_500_html_request_serves_error_app(self):
        response = self.client.get('/__crash__/', **HTML)
        self.assert_error_app_page(response, 500)
        self.assertContains(response, 'Server error (500)', status_code=500)

    def test_500_data_request_serves_drf_json(self):
        response = self.client.get('/__crash__/', **JSON)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {'error': 'Server Error (500)'})
        self.assertTemplateNotUsed(response, 'error_page.html')

    @override_config(
        TERMS_OF_SERVICE_URL='https://example.org/tos',
        PRIVACY_POLICY_URL='https://example.org/privacy',
    )
    def test_branding_is_passed_to_error_app(self):
        logo = ConfigurationFile.objects.create(
            slug=ConfigurationFileSlug.LOGO, content='logo/logo.png'
        )
        background = ConfigurationFile.objects.create(
            slug=ConfigurationFileSlug.LOGIN_BACKGROUND, content='bg/bg.jpg'
        )

        response = self.client.get('/accounts/blahblah/', **HTML)

        for attribute in [
            f'data-logo-url="{logo.url}"',
            f'data-background-url="{background.url}"',
            'data-terms-of-service-url="https://example.org/tos"',
            'data-privacy-policy-url="https://example.org/privacy"',
        ]:
            self.assertContains(response, attribute, status_code=404)

    @override_settings(GOOGLE_ANALYTICS_TOKEN='G-TEST123')
    def test_context_processors_run_normally(self):
        # Same as any other page: e.g. the GA token from `external_service_tokens`
        response = self.client.get('/accounts/blahblah/', **HTML)
        self.assertContains(
            response,
            '<meta name="google-analytics-token" content="G-TEST123">',
            status_code=404,
        )

    def test_500_page_survives_database_outage(self):
        """
        The case the fallback exists for: a 500 caused by the database must not
        crash the 500 handler when the `config` context processor reads
        branding from that same database. The page renders with Kobo's default
        branding instead.
        """
        with mock.patch.object(
            ConfigurationFile.objects,
            'all',
            side_effect=OperationalError('database is down'),
        ):
            response = self.client.get('/__crash__/', **HTML)

        self.assert_error_app_page(response, 500)
        self.assertContains(response, 'data-logo-url=""', status_code=500)
        self.assertContains(response, 'data-background-url=""', status_code=500)

    def test_404_page_survives_database_outage(self):
        # Without the fallback, Django would turn this into a 500
        with mock.patch.object(
            ConfigurationFile.objects,
            'all',
            side_effect=OperationalError('database is down'),
        ):
            response = self.client.get('/accounts/blahblah/', **HTML)

        self.assert_error_app_page(response, 404)

    def test_500_falls_back_to_static_html_if_template_fails(self):
        with mock.patch(
            'django.template.loader.get_template',
            side_effect=OSError('webpack-stats.json missing'),
        ):
            response = self.client.get('/__crash__/', **HTML)

        self.assertEqual(response.status_code, 500)
        self.assertContains(response, 'Server error (500)', status_code=500)


class DevErrorPagePreviewTestCase(TestCase):

    def test_preview_matches_real_error_page(self):
        # Called directly: the route is only registered with `DEBUG` on
        for error_code in [404, 500]:
            with self.subTest(error_code=error_code):
                request = RequestFactory().get(f'/__dev__/error/{error_code}/')
                response = dev_error_page_preview(request, str(error_code))
                self.assertEqual(response.status_code, error_code)
                self.assertContains(
                    response,
                    f'data-error-code="{error_code}"',
                    status_code=error_code,
                )
