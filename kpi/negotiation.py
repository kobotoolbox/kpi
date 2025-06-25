from rest_framework.negotiation import DefaultContentNegotiation as UpstreamDefaultContentNegociation


class DefaultContentNegotiation(UpstreamDefaultContentNegociation):

    def select_renderer(self, request, renderers, format_suffix=None):
        """
        This override the default rest framework select renderer in favor of supporting
        the received suffix first- so if we have it in our available renderer this one
        gets chosen, then the default serializer if there are no suffix and, if there are
        no renderers, we give the default for the app which is a JSONRenderer.
        """

        accepts = self.get_accept_list(request)

        if format_suffix is not None:
            for r in renderers:
                if r.format == format_suffix:
                    return r, r.media_type

        return renderers[0], renderers[0].media_type

