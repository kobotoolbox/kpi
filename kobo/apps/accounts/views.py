from allauth.account.models import EmailAddress
from rest_framework import status, viewsets, mixins
from .serializers import EmailAddressSerializer


class EmailAddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    View and change email. To set a new email, POST a new email address.
    The new email will be unverified and replace existing unverfied,
    non-primary emails.

    New email is not usable until verified.
    """

    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
