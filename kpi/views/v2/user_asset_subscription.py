# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets

from kpi.models import UserAssetSubscription
from kpi.serializers.v2.user_asset_subscription import (
    UserAssetSubscriptionSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.views.docs.asset_subscription.asset_subscription_doc import (
    asset_subscription_create,
    asset_subscription_destroy,
    asset_subscription_list,
    asset_subscription_get,
    asset_subscription_update,
    asset_subscription_partial_update
)

@extend_schema(
    tags=['asset-subscriptions'],
)
@extend_schema_view(
    create=extend_schema(
        description=asset_subscription_create,
    ),
    destroy=extend_schema(
        description=asset_subscription_destroy,
    ),
    list=extend_schema(
        description=asset_subscription_list,
    ),
    retrieve=extend_schema(
        description=asset_subscription_get,
    ),
    update=extend_schema(
        description=asset_subscription_update,
    ),
    partial_update=extend_schema(
        description=asset_subscription_partial_update,
    ),
)
class UserAssetSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = UserAssetSubscription.objects.none()
    serializer_class = UserAssetSubscriptionSerializer
    lookup_field = 'uid'

    def get_queryset(self):
        user = get_database_user(self.request.user)
        criteria = {'user': user}
        if 'asset__uid' in self.request.query_params:
            criteria['asset__uid'] = self.request.query_params[
                'asset__uid']
        return UserAssetSubscription.objects.filter(**criteria)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
