from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.versioning import APIV2Versioning
from .extend_schemas.api.v2.email.serializers import (
    EmailReauthenticationRequiredResponse,
    EmailRequestPayload,
)
from .mixins import MultipleFieldLookupMixin
from .permissions import NotManagedSSOPermission
from .reauthentication import (
    reauthentication_required,
    reauthentication_required_response,
)
from .serializers import EmailAddressSerializer, SocialAccountSerializer


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
        responses={
            **open_api_201_created_response(
                EmailAddressSerializer,
                raise_not_found=False,
                raise_access_forbidden=False,
            ),
            (status.HTTP_403_FORBIDDEN, 'application/json'): OpenApiResponse(
                response=EmailReauthenticationRequiredResponse,
                description=(
                    'The session is valid but the user has not re-authenticated'
                    ' recently enough. Walk the user through every flow listed'
                    ' in `flows`, then retry this request.'
                ),
                examples=[
                    OpenApiExample(
                        name='Re-authentication required',
                        value={
                            'detail': (
                                'Re-authentication is required for this action.'
                            ),
                            'code': 'reauthentication_required',
                            'flows': [
                                {'id': 'reauthenticate'},
                                {
                                    'id': 'mfa_reauthenticate',
                                    'types': ['totp'],
                                },
                            ],
                        },
                        response_only=True,
                        media_type='application/json',
                    )
                ],
            ),
        },
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

    def create(self, request, *args, **kwargs):
        # Changing the email address is a sensitive action: a stolen session could
        # otherwise be used to take the account over. Require re-authentication
        # before allowing the email address to be changed
        if reauthentication_required(request):
            return reauthentication_required_response(request)
        return super().create(request, *args, **kwargs)

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
