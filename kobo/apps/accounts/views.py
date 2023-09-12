from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from .mixins import MultipleFieldLookupMixin
from .serializers import EmailAddressSerializer, SocialAccountSerializer


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


class SocialAccountViewSet(
    MultipleFieldLookupMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    lookup_value_regex = r"(?P<provider>[^/.]+)/(?P<uid>[-\w]+)"
    lookup_fields = ['provider', 'uid']
    queryset = SocialAccount.objects.all()
    serializer_class = SocialAccountSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
