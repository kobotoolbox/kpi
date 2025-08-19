from rest_framework import viewsets

from .views import OpenRosaGenericView


class OpenRosaGenericViewSet(viewsets.ViewSetMixin, OpenRosaGenericView):
    pass


class OpenRosaReadOnlyModelViewSet(
    OpenRosaGenericView, viewsets.ReadOnlyModelViewSet
):
    pass


class OpenRosaModelViewSet(OpenRosaGenericView, viewsets.ModelViewSet):
    pass
