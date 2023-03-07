import stripe

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from djstripe.models import Customer, Product, Subscription, Price
from djstripe.settings import djstripe_settings
from organizations.utils import create_organization
from rest_framework import mixins, status, viewsets

from django.db.models import Prefetch
from djstripe.models import Plan, Product, Subscription
from rest_framework import mixins, renderers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.stripe.serializers import (
    SubscriptionSerializer,
    CheckoutLinkSerializer,
    CustomerPortalSerializer
)

from kobo.apps.organizations.models import (
    ProductSerializer,
    OrganizationUser,
    Organization
)

class CheckoutLinkView(
    APIView
):
    permission_classes = (IsAuthenticated,)
    serializer_class = CheckoutLinkSerializer

    @staticmethod
    def generate_payment_link(price_id, user, organization_uid):
        try:
            organization = Organization.objects.get(uid=organization_uid)
        except ObjectDoesNotExist:
            # Create an organization and organization user
            organization = create_organization(
                user,
                f"{user.username}'s organization",
                model=Organization
            )
        customer, created = Customer.get_or_create(
            subscriber=organization,
            livemode=settings.STRIPE_LIVE_MODE
        )
        # dj-stripe doesn't support adding metadata to customer on creation
        # So we use Stripe API methods to set the organization uid on the meta
        # See https://github.com/dj-stripe/dj-stripe/issues/399
        if created:
            stripe.Customer.modify(
                customer.id,
                api_key=djstripe_settings.STRIPE_SECRET_KEY,
                metadata={
                    'organization_uid': organization.uid
                },
            )
        session = CheckoutLinkView.start_checkout_session(customer.id, price_id, organization.uid)
        return session

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
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        price_id = serializer.validated_data['price_id']
        organization_uid = serializer.validated_data['organization_uid']
        try:
            Price.objects.get(
                active=True,
                product__active=True,
                id=price_id
            )
        except ObjectDoesNotExist:
            return Response({'status': 'Price not found or inactive'}, status=status.HTTP_404_NOT_FOUND)
        session = self.generate_payment_link(price_id, request.user, organization_uid)
        return Response({'url': session.url})


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
        )


class ProductViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    queryset = (
        Product.objects.filter(
            active=True,
            livemode=settings.STRIPE_LIVE_MODE,
            plan__active=True,
        )
        .prefetch_related(
            Prefetch("plan_set", queryset=Plan.objects.filter(active=True))
        )
        .distinct()
    )
    serializer_class = ProductSerializer
