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
                organization_user = OrganizationUser.objects.get(user=user)
                organization = Organization.objects.get(
                    uid=organization_uid
                )
            # If we can't find the organization or organization user, bail
            except ObjectDoesNotExist:
                return Response(
                    {'status': r'Organization does not exist'}, status=status.HTTP_403_FORBIDDEN
                )
        else:
            # find the organization the user belongs to, otherwise make a new one
            organization_user, _ = OrganizationUser.objects.get_or_create(user=user)
            organization, _ = Organization.objects.get_or_create(users=user)
        # Make sure the organization owner is the same as the logged-in user
        if organization.owner.id != organization_user.id:
            return Response({'status': r'Logged-in user is not organization owner'}, status=status.HTTP_403_FORBIDDEN)
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
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer_data = serializer.validated_data
        price_id = serializer_data['price_id']
        try:
            organization_uid = serializer.validated_data['organization_uid']
        except KeyError:
            organization_uid = None
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
