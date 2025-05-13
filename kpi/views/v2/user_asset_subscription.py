# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer

from kpi.models import UserAssetSubscription
from kpi.schema_extensions.v2.asset_subscriptions.serializers import (
    AssetSubscriptionPostRequestInlineSerializer,
    AssetSubscriptionPostResponseInlineSerializer,
)
from kpi.serializers.v2.user_asset_subscription import UserAssetSubscriptionSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)


@extend_schema(
    tags=['Asset-Subscriptions'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'asset_subscriptions/create.md'),
        request={'application/json': AssetSubscriptionPostRequestInlineSerializer},
        responses=open_api_201_created_response(
            AssetSubscriptionPostResponseInlineSerializer,
            media_type='application/json',
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'asset_subscriptions/delete.md'),
        responses=open_api_204_empty_response(),
    ),
    list=extend_schema(
        description=read_md('kpi', 'asset_subscriptions/list.md'),
        responses=open_api_200_ok_response(
            AssetSubscriptionPostResponseInlineSerializer,
            media_type='application/json',
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'asset_subscriptions/retrieve.md'),
        responses=open_api_200_ok_response(
            AssetSubscriptionPostResponseInlineSerializer, media_type='application/json'
        ),
    ),
    update=extend_schema(
        exclude=True,
    ),
    partial_update=extend_schema(
        exclude=True,
    ),
)
class UserAssetSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = UserAssetSubscription.objects.none()
    serializer_class = UserAssetSubscriptionSerializer
    lookup_field = 'uid'

    renderer_classes = [JSONRenderer]

    def get_queryset(self):
        user = get_database_user(self.request.user)
        criteria = {'user': user}
        if 'asset__uid' in self.request.query_params:
            criteria['asset__uid'] = self.request.query_params[
                'asset__uid']
        return UserAssetSubscription.objects.filter(**criteria)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
