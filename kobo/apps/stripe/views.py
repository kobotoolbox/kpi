from django.conf import settings
from djstripe.models import Product
from rest_framework import viewsets

from .serializers import ProductSerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(
        active=True,
        livemode=settings.STRIPE_LIVE_MODE,
    ).prefetch_related('plan_set')
    serializer_class = ProductSerializer
