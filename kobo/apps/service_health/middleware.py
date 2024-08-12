from django.http import HttpResponse


class HealthCheckMiddleware:
    """
    Provides healthcheck URL that skips other middleware.
    Add this before SecurityMiddleware.
    https://stackoverflow.com/a/64623669
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/service_health/minimal/':
            return HttpResponse('ok', content_type='text/plain')
        return self.get_response(request)
