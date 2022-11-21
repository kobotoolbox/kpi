from allauth.account.models import EmailAddress
from rest_framework import status, viewsets, mixins
from .serializers import EmailAddressSerializer


class EmailAddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
