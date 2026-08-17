from django.template.response import TemplateResponse


def dev_error_page_preview(request, error_code: int):
    """
    Render an error page on demand, so the standalone error app can be worked on
    in a browser.

    Django serves its own technical 404/500 pages while `DEBUG` is on, which
    makes the real `handler404`/`handler500` unreachable in local development.
    Only registered when `DEBUG` is enabled; see `kpi/urls/__init__.py`.

    Branding (logo, background, footer links) is not passed in here. It reaches
    the template through the global `kpi.context_processors.config` processor.
    """
    return TemplateResponse(request, 'error_page.html', {'error_code': int(error_code)})
