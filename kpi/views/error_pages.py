import constance
from django.http import HttpResponse
from django.template.loader import render_to_string

from hub.models import ConfigurationFile
from hub.models.configuration_file import ConfigurationFileSlug
from kpi.utils.log import logging

ERROR_PAGE_TEMPLATE = 'error_page.html'

# Served if `error_page.html` itself can't be rendered, so a 500 never ends up
# as the app server's bare "Internal Server Error". Deliberately not translated:
# translation is one more thing that could be what's broken
LAST_RESORT_500_HTML = (
    '<!doctype html><html><head><meta charset="utf-8"><title>KoboToolbox</title>'
    '</head><body><h1>Server error (500)</h1>'
    '<p>Something went wrong when trying to process your request.</p>'
    '</body></html>'
)


def get_error_page_branding() -> dict:
    """
    Read the instance branding the error app shows: logo, background and footer
    links

    This hits the database (`ConfigurationFile` and constance), which may well
    be what's broken when a 500 is being served. Any failure therefore returns
    empty values, which the error app treats as "not configured" and replaces
    with Kobo defaults.
    """
    try:
        files = {
            f.slug: f.url
            for f in ConfigurationFile.objects.filter(
                slug__in=[
                    ConfigurationFileSlug.LOGO,
                    ConfigurationFileSlug.LOGIN_BACKGROUND,
                ]
            )
        }
        return {
            'logo': files.get(ConfigurationFileSlug.LOGO, ''),
            'login_background': files.get(ConfigurationFileSlug.LOGIN_BACKGROUND, ''),
            'TERMS_OF_SERVICE_URL': constance.config.TERMS_OF_SERVICE_URL,
            'PRIVACY_POLICY_URL': constance.config.PRIVACY_POLICY_URL,
        }
    except Exception:
        logging.warning('Error page rendered without branding', exc_info=True)
        return {
            'logo': '',
            'login_background': '',
            'TERMS_OF_SERVICE_URL': '',
            'PRIVACY_POLICY_URL': '',
        }


def render_error_page(error_code: int) -> HttpResponse:
    """
    Render the shell of the standalone error app (`jsapp/js/errorApp/`)

    Rendered without the request on purpose, the same way Django's own
    `defaults.server_error` does it: passing the request would run every
    context processor in `settings.TEMPLATES`, and several of them query the
    database. If the database is why we're serving a 500, that would make the
    500 handler crash too. The template gets only what's built here.
    """
    context = {
        'error_code': error_code,
        'config': get_error_page_branding(),
    }
    return HttpResponse(
        render_to_string(ERROR_PAGE_TEMPLATE, context), status=error_code
    )


def render_500_page() -> HttpResponse:
    """
    The 500 page, plus a hard-coded fallback for when even the template can't
    be rendered (e.g. a broken webpack stats file). Django doesn't catch
    exceptions raised by `handler500`, so this has to be the last line of defence
    """
    try:
        return render_error_page(500)
    except Exception:
        logging.error('Could not render the 500 error page', exc_info=True)
        return HttpResponse(LAST_RESORT_500_HTML, status=500)


def dev_error_page_preview(request, error_code: int):
    """
    Render an error page on demand, so the standalone error app can be worked on
    in a browser.

    Django serves its own technical 404/500 pages while `DEBUG` is on, so the
    real `handler404`/`handler500` (`kobo/urls.py`) can't be reached in local
    development. This renders exactly what they would serve. Only registered
    when `DEBUG` is enabled; see `kpi/urls/__init__.py`.
    """
    return render_error_page(int(error_code))
