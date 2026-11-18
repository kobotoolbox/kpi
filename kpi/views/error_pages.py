from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.template.loader import render_to_string

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


def render_error_page(request: HttpRequest, error_code: int) -> HttpResponse:
    """
    Render the shell of the standalone error app (`jsapp/js/errorApp/`)

    Normally rendered like any other page, so the context processors supply the
    branding (`config`) and everything else the base template expects.

    Several context processors query the database, which may well be why we're
    serving an error in the first place. If rendering fails, the page is
    rendered again without the request, so no context processors run. The
    branding is then missing, and the error app falls back to Kobo defaults.
    """
    context = {'error_code': error_code}
    try:
        return render(request, ERROR_PAGE_TEMPLATE, context, status=error_code)
    except Exception:
        logging.warning(
            f'Error page {error_code} rendered without context processors',
            exc_info=True,
        )
        return HttpResponse(
            render_to_string(ERROR_PAGE_TEMPLATE, context), status=error_code
        )


def render_500_page(request: HttpRequest) -> HttpResponse:
    """
    The 500 page, plus a hard-coded fallback for when even the template can't
    be rendered (e.g. a broken webpack stats file). Django doesn't catch
    exceptions raised by `handler500`, so this has to be the last line of defence
    """
    try:
        return render_error_page(request, 500)
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
    return render_error_page(request, int(error_code))
