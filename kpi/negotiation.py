from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.renderers import JSONRenderer


class DefaultContentNegotiation(BaseContentNegotiation):
    def select_renderer(self, request, renderers, format_suffix):
        """
        This override the default rest framework select renderer in favor of supporting
        the recieved suffix first- so if we have it in our available renderer this one
        gets chosen, then the default serializer if there are no suffix and, if there are
        no renderers, we give the default for the app which is a JSONRenderer.
        """
        if format_suffix is not None:
            for r in renderers:
                if r.format == format_suffix:
                    return (r, r.media_type)

        if renderers is not None:
            return (renderers[0], renderers[0].media_type)

        return (JSONRenderer(), JSONRenderer.media_type)
