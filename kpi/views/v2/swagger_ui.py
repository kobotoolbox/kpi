from drf_spectacular.views import SpectacularSwaggerView


class ExtendedSwaggerUIView(SpectacularSwaggerView):
    template_name = 'drf_spectacular/swagger_ui.html'
