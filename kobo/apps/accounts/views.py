from allauth.account.internal.flows.email_verification import (
    send_verification_email_to_address,
)
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.db.models import Exists, OuterRef
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.utils.log import logging
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.versioning import APIV2Versioning
from .constants import EMAIL_CONFIRMATION_REQUESTED_DETAIL
from .extend_schemas.api.v2.email.examples import (
    get_email_confirmation_request_examples,
)
from .extend_schemas.api.v2.email.serializers import (
    EmailConfirmationRequestPayload,
    EmailConfirmationRequestResponse,
    EmailRequestPayload,
)
from .mixins import MultipleFieldLookupMixin
from .permissions import NotManagedSSOPermission
from .serializers import (
    EmailAddressSerializer,
    EmailConfirmationRequestSerializer,
    SocialAccountSerializer,
)
from .throttling import EmailConfirmationRequestEmailThrottle


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    list=extend_schema(
        description=read_md('accounts', 'me/email/list.md'),
        responses=open_api_200_ok_response(
            EmailAddressSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    create=extend_schema(
        description=read_md('accounts', 'me/email/create.md'),
        request={'application/json': EmailRequestPayload},
        responses=open_api_201_created_response(
            EmailAddressSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
        ),
    ),
)
class EmailAddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    Viewset for managing current user email address

    Available actions:
    - list           → GET       /me/
    - create         → CREATE    /me/

    Documentation:
    - docs/api/v2/me/email/list.md
    - docs/api/v2/me/email/create.md
    """

    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def delete(self, request, format=None):
        request.user.emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('accounts', 'me/social/delete.md'),
        responses=open_api_204_empty_response(
            raise_access_forbidden=True,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('accounts', 'me/social/list.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('accounts', 'me/social/retrieve.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class SocialAccountViewSet(
    MultipleFieldLookupMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Viewset for managing current user's socials

    Available actions:
    - destroy        → DELETE   /me/social-accounts/{provider}/{uid_social_account}/
    - list           → GET      /me/social-accounts/
    - retrieve       → GET      /me/social-accounts/{provider}/{uid_social_account}/

    Documentation:
    - docs/api/v2/me/social/destroy.md
    - docs/api/v2/me/social/list.md
    - docs/api/v2/me/social/retrieve.md
    """

    lookup_value_regex = r'(?P<provider>[^/.]+)/(?P<uid_social_account>[-\w]+)'
    lookup_fields = ['provider', 'uid']
    lookup_field_map = {'uid': 'uid_social_account'}
    queryset = SocialAccount.objects.all()
    serializer_class = SocialAccountSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning

    def get_permissions(self):
        if self.action == 'destroy':
            return (
                IsAuthenticated(),
                NotManagedSSOPermission(),
            )
        return super().get_permissions()

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    post=extend_schema(
        description=read_md('accounts', 'email_confirmations/create.md'),
        request={'application/json': EmailConfirmationRequestPayload},
        responses=open_api_200_ok_response(
            EmailConfirmationRequestResponse,
            require_auth=False,
            raise_access_forbidden=False,
            raise_not_found=False,
            raise_throttled=True,
            validations_errors={'email': ['Enter a valid email address.']},
        ),
        examples=get_email_confirmation_request_examples(),
    ),
)
class EmailConfirmationView(APIView):
    """
    Send another account confirmation email, on request

    Available actions:
    - create         → POST     /api/v2/email-confirmations/

    Documentation:
    - docs/api/v2/email_confirmations/create.md

    The response is identical whether the address is unverified, already verified,
    or unknown, so the endpoint cannot be used to discover who holds an account.
    Mail is only ever sent in the first of those cases.

    Which email that is depends on the account: one with nothing verified yet is
    being activated and gets the activation email, while one that already has a
    verified address is partway through an email change and gets the address
    verification email.
    """

    permission_classes = (AllowAny,)
    versioning_class = APIV2Versioning
    serializer_class = EmailConfirmationRequestSerializer
    throttle_classes = (EmailConfirmationRequestEmailThrottle,)

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        for address in self._get_unverified_addresses(
            serializer.validated_data['email']
        ):
            # An account with nothing verified yet is being activated; one that
            # already has a verified address is changing it. Different moments in
            # a user's life, so they get different emails
            self._send_confirmation(
                request,
                address,
                activation=not address.user_has_verified_address,
            )

        return Response(
            {'detail': EMAIL_CONFIRMATION_REQUESTED_DETAIL},
            status=status.HTTP_200_OK,
        )

    def _get_unverified_addresses(self, email):
        """
        Get every unverified row for this address whose owner is still active

        One address can belong to several accounts, and each owner is entitled to
        their own link. The annotation says whether that owner already has a
        verified address, which is what tells an activation apart from a pending
        email change.

        Matched on the lowercased address, the way allauth looks this table up,
        because `iexact` compiles to `UPPER(email) = UPPER(%s)`, which no index
        covers and which turns into a sequential scan over a row per user.
        """
        return (
            EmailAddress.objects.filter(
                email=email.strip().lower(), verified=False, user__is_active=True
            )
            .annotate(
                user_has_verified_address=Exists(
                    EmailAddress.objects.filter(
                        user_id=OuterRef('user_id'), verified=True
                    )
                )
            )
            .select_related('user')
        )

    def _send_confirmation(self, request, address, activation):
        """
        `activation` picks the template. allauth exposes that choice as its
        `signup` flag, which in the send path selects the "activate your account"
        email over the "verify your address" one and does nothing else, so a
        resent activation link belongs on it even though no signup is happening

        Delivery failures are logged rather than raised: mail is only ever
        attempted for a registered address, so a 5xx would confirm the address is
        registered.
        """
        try:
            send_verification_email_to_address(request, address, signup=activation)
        except Exception:
            logging.exception(
                'Failed to send a requested confirmation email for EmailAddress %s',
                address.pk,
            )
