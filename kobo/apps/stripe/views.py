from django.conf import settings
from djstripe.models import Product, Subscription
from rest_framework import mixins, renderers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from kobo.apps.stripe.serializers import (
    SubscriptionSerializer
)


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
