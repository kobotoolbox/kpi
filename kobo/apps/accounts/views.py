from allauth.account.models import EmailAddress
from rest_framework import status, viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import EmailAddressSerializer


class EmailAddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    View and change email. Allow only 1 primary/confirmed email.

    Set a new email: POST a new email address. The new email will be unverified
    and replace existing unverfied, non-primary emails. New email is not usable
    until verified.

    Delete unconfirmed email: DELETE with no body will delete any existing
    non-primary/non-verified emails.
    """

    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def delete(self, request, format=None):
        request.user.emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
