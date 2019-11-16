# coding: utf-8
from rest_framework import viewsets
from kpi.models import UserCollectionSubscription

from kpi.models.object_permission import get_anonymous_user
from kpi.serializers import UserCollectionSubscriptionSerializer


class UserCollectionSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = UserCollectionSubscription.objects.none()
    serializer_class = UserCollectionSubscriptionSerializer
    lookup_field = 'uid'

    def get_queryset(self):
        user = self.request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous:
            user = get_anonymous_user()
        criteria = {'user': user}
        if 'collection__uid' in self.request.query_params:
            criteria['collection__uid'] = self.request.query_params[
                'collection__uid']
        return UserCollectionSubscription.objects.filter(**criteria)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
