from rest_framework.negotiation import DefaultContentNegotiation as UpstreamDefaultContentNegociation


class DefaultContentNegotiation(UpstreamDefaultContentNegociation):

    def select_renderer(self, request, renderers, format_suffix=None):
        """
        Overrides the default DRF `select_renderer` to handle cases where the client
        does not specify a compatible `Accept` header nor a format suffix.

        If the first available renderer is not included in the accepted media types
        and no explicit format suffix is given, this override will forcibly return
        the first renderer in the list.

        Otherwise, the default DRF negotiation logic is applied.
        """
        format_query_param = self.settings.URL_FORMAT_OVERRIDE
        format_ = format_suffix or request.query_params.get(format_query_param)
        accepts = self.get_accept_list(request)

        first_renderer = renderers[0]
        first_renderer_format_allowed = first_renderer.format in accepts

        if not first_renderer_format_allowed and not format_:
            # force fallback to first renderer
            return first_renderer, first_renderer.media_type

        # otherwise fallback to DRF's default content negotiation
        return super().select_renderer(request, renderers, format_suffix)
