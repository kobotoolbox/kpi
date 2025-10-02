from rest_framework.negotiation import (
    DefaultContentNegotiation as UpstreamDefaultContentNegociation,
)


class DefaultContentNegotiation(UpstreamDefaultContentNegociation):

    def select_renderer(self, request, renderers, format_suffix=None):
        """
        Overrides DRF's `select_renderer` to customize content negotiation.

        - If the client request comes from a browser (i.e., the Accept header
          includes `text/html`) and `BasicHTMLRenderer` is available, use it
          as the renderer.

        - If the first available renderer is not included in the accepted media
          types and no explicit format suffix is provided, fall back to the
          first renderer in the list.

        - In all other cases, defer to DRF's default content negotiation logic.
        """
        format_query_param = self.settings.URL_FORMAT_OVERRIDE
        format_ = format_suffix or request.query_params.get(format_query_param)
        accepts = self.get_accept_list(request)

        first_renderer = renderers[0]
        first_renderer_format_allowed = first_renderer.format in accepts

        # Force HTML if the request comes from a browser
        # (i.e., the Accept header includes HTML) and `BasicHTMLRenderer` is available
        # in the list of renderers.
        if (
            'text/html' in accepts
            and len(renderers) > 1
            and renderers[1].__class__.__name__ == 'BasicHTMLRenderer'
        ):
            return renderers[1], renderers[1].media_type

        # Force fallback to the first renderer
        if not first_renderer_format_allowed and not format_:
            return first_renderer, first_renderer.media_type

        # Otherwise fallback to DRF's default content negotiation
        return super().select_renderer(request, renderers, format_suffix)
