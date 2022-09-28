from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from djstripe.models import Customer, Product, Subscription
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kobo.apps.stripe.serializers import (
    # CustomerSerializer,
    ProductSerializer,
    SubscriptionSerializer
)


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(
        active=True,
        livemode=settings.STRIPE_LIVE_MODE,
    ).prefetch_related('plan_set')
    serializer_class = ProductSerializer


class SubscriptionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    model = Subscription
    serializer_class = SubscriptionSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user_orgs = self.request.user.organizations_organization.values_list(
            'id',
            flat=True,
        ).all()
        queryset = Subscription.objects.filter(
            customer__subscriber_id__in=user_orgs,
        )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(queryset, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        user_orgs = self.request.user.organizations_organization.values_list(
            'id',
            flat=True,
        ).all()
        sub = Subscription.objects.get(
            id=kwargs['id'],
            customer__subscriber_id__in=user_orgs,
        )
        serializer = self.get_serializer(sub)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        user_orgs = self.request.user.organizations_organization.values_list(
            'id',
            flat=True,
        ).all()
        partial = kwargs.pop('partial', False)
        sub = Subscription.objects.get(
            id=kwargs['id'],
            customer__subscriber_id__in=user_orgs,
        )
        serializer = self.get_serializer(sub, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)
