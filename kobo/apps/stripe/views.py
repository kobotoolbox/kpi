import stripe

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from djstripe.models import Customer, Product, Subscription, Price
from djstripe.settings import djstripe_settings
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from kobo.apps.stripe.serializers import (
    SubscriptionSerializer,
    CheckoutLinkSerializer
)

from kobo.apps.organizations.models import (
    OrganizationUser,
    Organization
)

#TODO: rename to Payment Link
class CheckoutLinkView(
    APIView
):
    permission_classes = ()

    @staticmethod
    def generate_payment_link(price, user):
        organization = Organization.objects.get(organization_users=user.id)
        customer, _ = Customer.get_or_create(subscriber=organization, livemode=False)
        session = stripe.checkout.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            cancel_url='http://replace.me',
            customer=customer.id,
            metadata={
                'uid': organization.uid
            },
            success_url='http://replace.me.too',
            line_items=[
                {
                    "price": price['id'],
                    "quantity": 1,
                },
            ],
            mode="subscription",
        )
        return session

    def get(self, request, format=None):
        prices = Price.objects.filter(active=True).values()
        session = self.generate_payment_link(list(prices)[1], request.user)
        return JsonResponse({"url": session.url})

class CustomerPortalView(
    APIView
):
    permission_classes = (IsAuthenticated,)

    @staticmethod
    def generate_portal_link(user):
        organization = Organization.objects.get(organization_users=user.id)
        customer = Customer.objects.get(subscriber=organization, livemode=False)
        if not customer:
            raise Exception
        session = stripe.billing_portal.Session.create(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=customer.id,
            return_url='http://replace.me'
        )
        return session

    def get(self, request, format=None):
        session = self.generate_portal_link(request.user)
        return JsonResponse({"url": session.url})

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
