from django.template.response import TemplateResponse


def home(request):
    return TemplateResponse(request, 'index.html')


def modern_browsers(request):
    return TemplateResponse(request, 'modern_browsers.html')
