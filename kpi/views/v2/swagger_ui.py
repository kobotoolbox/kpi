import os

from django.templatetags.static import static
from drf_spectacular.views import SpectacularSwaggerView


class ExtendedSwaggerUIView(SpectacularSwaggerView):
    template_name = 'drf_spectacular/swagger_ui.html'

    def _swagger_ui_resource(self, filename):
        if filename in [
            'swagger-ui.css',
            'swagger-ui-bundle.js',
            'swagger-ui-standalone-preset.js',
        ]:
            _, ext = os.path.splitext(filename)
            return static(os.path.join(ext[1:], 'swagger', filename))

        return super()._swagger_ui_resource(filename)  # noqa
