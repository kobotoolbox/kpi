from django.conf import settings
from django.db.models import Prefetch
from djstripe.models import Plan, Product, Subscription
from rest_framework import mixins, renderers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from kobo.apps.stripe.serializers import SubscriptionSerializer
from .serializers import ProductSerializer


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
