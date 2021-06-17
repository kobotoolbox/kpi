# coding: utf-8
from rest_framework import viewsets
from kpi.models import UserAssetSubscription

from kpi.models.object_permission import get_anonymous_user
from kpi.serializers.v2.user_asset_subscription import \
    UserAssetSubscriptionSerializer


class UserAssetSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = UserAssetSubscription.objects.none()
    serializer_class = UserAssetSubscriptionSerializer
    lookup_field = 'uid'

    def get_queryset(self):
        user = self.request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous:
            user = get_anonymous_user()
        criteria = {'user': user}
        if 'asset__uid' in self.request.query_params:
            criteria['asset__uid'] = self.request.query_params[
                'asset__uid']
        return UserAssetSubscription.objects.filter(**criteria)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
