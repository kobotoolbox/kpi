import stripe

from django.conf import settings
from django.db.models import Prefetch, Min

from djstripe.models import (
    Customer,
    Price,
    Product,
    Session,
    Subscription,
    SubscriptionItem,
)
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
    OneTimeAddOnSerializer,
    ProductSerializer,
)

from kobo.apps.organizations.models import Organization


# Lists the one-time purchases made by the organization that the logged-in user owns
class OneTimeAddOnViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = OneTimeAddOnSerializer
    queryset = Session.objects.all()

    def get_queryset(self):
        return self.queryset.filter(
            livemode=settings.STRIPE_LIVE_MODE,
            customer__subscriber__owner__organization_user__user=self.request.user,
            mode='payment',
            payment_intent__status__in=['succeeded', 'processing'],
        ).prefetch_related('payment_intent')


class CheckoutLinkView(APIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = CheckoutLinkSerializer

    @staticmethod
    def generate_payment_link(price, user, organization_uid):
        if organization_uid:
            # Get the organization for the logged-in user and provided organization UID
            organization = Organization.objects.get(
                uid=organization_uid, owner__organization_user__user_id=user
            )
        else:
            # Find the first organization the user belongs to, otherwise make a new one
            organization = Organization.objects.filter(
                users=user, owner__organization_user__user_id=user
            ).first()
            if not organization:
                organization = create_organization(
                    user,
                    f"{user.username}'s organization",
                    model=Organization,
                    owner__user=user,
                )
        customer, _ = Customer.get_or_create(
            subscriber=organization, livemode=settings.STRIPE_LIVE_MODE
        )
        # Add the name and organization to the customer if not present.
        # djstripe doesn't let us do this on customer creation, so modify the customer on Stripe and then fetch locally.
        if not customer.name and user.extra_details.data['name']:
            stripe_customer = stripe.Customer.modify(
                customer.id,
                name=user.extra_details.data['name'],
                description=organization.name,
                api_key=djstripe_settings.STRIPE_SECRET_KEY,
            )
            customer.sync_from_stripe_data(stripe_customer)
        session = CheckoutLinkView.start_checkout_session(
            customer.id, price, organization.uid
        )
        return Response({'url': session['url']})

    @staticmethod
    def start_checkout_session(customer_id, price, organization_uid):
        checkout_mode = (
            'payment' if price.type == 'one_time' else 'subscription'
        )
        return stripe.checkout.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            automatic_tax={'enabled': False},
            customer=customer_id,
            line_items=[
                {
                    "price": price.id,
                    "quantity": 1,
                },
            ],
            metadata={
                'organization_uid': organization_uid,
                'price_id': price.id,
            },
            mode=checkout_mode,
            success_url=f'{settings.KOBOFORM_URL}/#/account/plan?checkout={price.id}',
        )

    def post(self, request):
        serializer = CheckoutLinkSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        price = serializer.validated_data.get('price_id')
        organization_uid = serializer.validated_data.get('organization_uid')
        response = self.generate_payment_link(
            price, request.user, organization_uid
        )
        return response


class CustomerPortalView(APIView):
    permission_classes = (IsAuthenticated,)

    @staticmethod
    def generate_portal_link(user, organization_uid):
        organization = Organization.objects.get(
            uid=organization_uid, owner__organization_user__user_id=user
        )
        customer = Customer.objects.get(
            subscriber=organization, livemode=settings.STRIPE_LIVE_MODE
        )
        session = stripe.billing_portal.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/account/plan',
        )
        return session

    def post(self, request):
        serializer = CustomerPortalSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        organization_uid = serializer.validated_data['organization_uid']
        session = self.generate_portal_link(request.user, organization_uid)
        return Response({'url': session['url']})


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
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
    Returns Product and Price Lists, sorted from the product with the lowest price to highest

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

    ### Note: unit_amount is price in cents (assuming currency is USD/AUD/CAD/etc.)

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
        .annotate(lowest_unit_amount=Min('prices__unit_amount'))
        .order_by('lowest_unit_amount')
        .distinct()
    )
    serializer_class = ProductSerializer
