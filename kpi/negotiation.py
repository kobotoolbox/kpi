from rest_framework.negotiation import DefaultContentNegotiation as UpstreamDefaultContentNegociation


class DefaultContentNegotiation(UpstreamDefaultContentNegociation):

    def select_renderer(self, request, renderers, format_suffix=None):
        """
        This override the default rest framework select renderer in favor of supporting
        the received suffix first- so if we have it in our available renderer this one
        gets chosen, then the default serializer if there are no suffix and, if there are
        no renderers, we give the default for the app which is a JSONRenderer.
        """

        format_query_param = self.settings.URL_FORMAT_OVERRIDE
        format_ = format_suffix or request.query_params.get(format_query_param)

        if format_ is not None:
            for r in renderers:
                if r.format == format_:
                    return r, r.media_type

        return super().select_renderer(request, renderers, format_suffix)
