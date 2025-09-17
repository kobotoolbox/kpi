import os

from django.templatetags.static import static
from drf_spectacular.utils import extend_schema
from drf_spectacular.views import SpectacularSwaggerView
from rest_framework.response import Response


class ExtendedSwaggerUIView(SpectacularSwaggerView):
    template_name = 'drf_spectacular/swagger_ui.html'

    def _swagger_ui_resource(self, filename):
        if filename in [
            'swagger-ui.css',
            'swagger-ui-bundle.js',
            'swagger-ui-standalone-preset.js',
            'swagger-ui-init.js',
        ]:
            _, ext = os.path.splitext(filename)
            return static(os.path.join(ext[1:], 'swagger', filename))

        return super()._swagger_ui_resource(filename)  # noqa

    @extend_schema(exclude=True)
    def get(self, request, *args, **kwargs):

        response = super().get(request, *args, **kwargs)
        context = response.data

        context['data_schema_url'] = context.get('schema_url', '')

        context['script_url'] = self._swagger_ui_resource('swagger-ui-init.js')

        return Response(
            data=context,
            template_name=self.template_name,
        )
