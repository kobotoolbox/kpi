from django.template.response import TemplateResponse
from django.views.decorators.cache import never_cache


# The app shell holds the logged-in user's data in memory, so the browser must
# not keep it around after logout, e.g. to restore it on Back
@never_cache
def home(request):
    return TemplateResponse(request, 'index.html')


def modern_browsers(request):
    return TemplateResponse(request, 'modern_browsers.html')
