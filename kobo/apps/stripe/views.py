import stripe

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist'
from django.db.models import Prefetch

from djstripe.models import Customer, Price, Product, Subscription, SubscriptionItem
from djstripe.settings import djstripe_settings

from organizations.utils import create_organization

from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.stripe.serializers import (
    SubscriptionSerializer,
    CheckoutLinkSerializer,
    CustomerPortalSerializer,
    ProductSerializer,
)

from kobo.apps.organizations.models import (
    OrganizationUser,
    OrganizationOwner,
    Organization
)

class CheckoutLinkView(
    APIView
):
    permission_classes = (IsAuthenticated,)
    serializer_class = CheckoutLinkSerializer

    @staticmethod
    def generate_payment_link(price_id, user, organization_uid):
        if organization_uid:
            # Look up the specific organization provided
            try:
                organization = Organization.objects.get(
                    uid=organization_uid,
                    organization_users__user=user
                )
            # If we can't find the organization or organization user, bail
            except ObjectDoesNotExist:
                return Response(
                    {'status': r'Organization does not exist'}, status=status.HTTP_403_FORBIDDEN
                )
        else:
            # Find the first organization the user belongs to, otherwise make a new one
            organization = Organization.objects.filter(users=user, owner__organization_user__user_id=user).first()
            if not organization:
                organization = create_organization(
                    user, f"{user.username}'s organization", model=Organization, owner__user=user
                )
        customer, created = Customer.get_or_create(
            subscriber=organization,
            livemode=settings.STRIPE_LIVE_MODE
        )
        session = CheckoutLinkView.start_checkout_session(customer.id, price_id, organization.uid)
        return Response({'url': session})

    @staticmethod
    def start_checkout_session(customer_id, price_id, organization_uid):
        session = stripe.checkout.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            automatic_tax={
                'enabled': False
            },
            customer=customer_id,
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                },
            ],
            metadata={
                'organization_uid': organization_uid
            },
            mode="subscription",
            payment_method_types=["card"],
            success_url=f'{settings.KOBOFORM_URL}/#/plans?checkout_complete=true',
        )
        return session

    def post(self, request):
        serializer = CheckoutLinkSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        serializer_data = serializer.validated_data
        price_id = serializer_data['price_id']
        organization_uid = serializer.validated_data.get('organization_uid')
        try:
            Price.objects.get(
                active=True,
                product__active=True,
                id=price_id
            )
        except ObjectDoesNotExist:
            return Response({'status': 'Price not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        response = self.generate_payment_link(price_id, request.user, organization_uid)
        return response


class CustomerPortalView(
    APIView
):
    permission_classes = (IsAuthenticated,)

    @staticmethod
    def generate_portal_link(organization_uid):
        organization = Organization.objects.get(uid=organization_uid)
        customer = Customer.objects.get(
            subscriber=organization,
            livemode=settings.STRIPE_LIVE_MODE
        )
        session = stripe.billing_portal.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/plans'
        )
        return session

    def post(self, request):
        serializer = CustomerPortalSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        organization_uid = serializer.validated_data['organization_uid']
        session = self.generate_portal_link(organization_uid)
        return Response({'url': session.url})


class SubscriptionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return self.queryset.filter(
            livemode=settings.STRIPE_LIVE_MODE,
            customer__subscriber__users=self.request.user,
        ).prefetch_related(
            Prefetch(
                'items',
                queryset=SubscriptionItem.objects.select_related(
                    'price__product'
                ),
            )
        )


class ProductViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    Returns Product and Price Lists

    <pre class="prettyprint">
    <b>GET</b> /api/v2/stripe/products/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/stripe/products/

    > Response
    >
    >       HTTP 200 Ok
    >        {
    >           "count": ...
    >           "next": ...
    >           "previous": ...
    >           "results": [
    >               {
    >                   "id": string,
    >                   "name": string,
    >                   "type": string,
    >                   "prices": [
    >                       {
    >                           "id": string,
    >                           "nickname": string,
    >                           "currency": string,
    >                           "type": string,
    >                           "unit_amount": int (cents),
    >                           "human_readable_price": string,
    >                           "metadata": {}
    >                       },
    >                       ...
    >                   ],
    >                   "metadata": {},
    >               },
    >               ...
    >           ]
    >        }
    >

    ### Note: unit_amount is price in cents

    ## Current Endpoint
    """

    queryset = (
        Product.objects.filter(
            active=True,
            livemode=settings.STRIPE_LIVE_MODE,
            prices__active=True,
        )
        .prefetch_related(
            Prefetch('prices', queryset=Price.objects.filter(active=True))
        )
        .distinct()
    )
    serializer_class = ProductSerializer
