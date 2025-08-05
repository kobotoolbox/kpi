from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response, \
    open_api_201_created_response, open_api_204_empty_response
from kpi.versioning import APIV2Versioning
from .extend_schemas.api.v2.email.serializers import EmailRequestPayload
from .mixins import MultipleFieldLookupMixin
from .serializers import EmailAddressSerializer, SocialAccountSerializer


@extend_schema(
    tags=['Me'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('accounts', 'email/list.md'),
        responses=open_api_200_ok_response(
            EmailAddressSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        )
    ),
    create=extend_schema(
        description=read_md('accounts', 'email/create.md'),
        request={'application/json': EmailRequestPayload},
        responses=open_api_201_created_response(
            EmailAddressSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
        )
    )
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
    - docs/api/v2/me/list.md
    - docs/api/v2/me/create.md
    """

    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning
    renderer_classes = [
        JSONRenderer,
    ]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def delete(self, request, format=None):
        request.user.emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=['Me']
)
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('accounts', 'social/delete.md'),
        responses=open_api_204_empty_response(
            raise_access_forbidden=False,
            validate_payload=False,
        )
    ),
    list=extend_schema(
        description=read_md('accounts', 'social/list.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        )
    ),
    retrieve=extend_schema(
        description=read_md('accounts', 'social/retrieve.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_access_forbidden=False,
            validate_payload=False,
        )
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
    - destroy        → DELETE   /me/social-accounts/{provider}/{uid}/
    - list           → GET      /me/social-accounts/
    - retrieve       → GET      /me/social-accounts/{provider}/{uid}/

    Documentation:
    - docs/api/v2/social/destroy.md
    - docs/api/v2/social/list.md
    - docs/api/v2/social/retrieve.md
    """

    lookup_value_regex = r'(?P<provider>[^/.]+)/(?P<uid>[-\w]+)'
    lookup_fields = ['provider', 'uid']
    queryset = SocialAccount.objects.all()
    serializer_class = SocialAccountSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning
    renderer_classes = [
        JSONRenderer,
    ]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
