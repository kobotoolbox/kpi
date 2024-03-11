from django.conf import settings
from django.db.models import QuerySet
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_dont_vary_on.decorators import only_vary_on
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.object_permission import get_database_user
from .models import Organization, create_organization
from .permissions import IsOrgAdminOrReadOnly
from .serializers import OrganizationSerializer


@method_decorator(cache_page(settings.ENDPOINT_CACHE_DURATION), name='service_usage')
# django uses the Vary header in its caching, and each middleware can potentially add more Vary headers
# we use this decorator to remove any Vary headers except 'origin' (we don't want to cache between different installs)
@method_decorator(only_vary_on('Origin'), name='service_usage')
class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organizations are groups of users with assigned permissions and configurations

    - Organization admins can manage the organization and it's membership
    - Connect to authentication mechanisms and enforce policy
    - Create teams and projects under the organization
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated, IsOrgAdminOrReadOnly)

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        queryset = super().get_queryset().filter(users=user)
        if self.action == "list" and not queryset:
            # Very inefficient get or create queryset.
            # It's temporary and should be removed later.
            create_organization(user, f"{user.username}'s organization")
            queryset = queryset.all()  # refresh
        return queryset

    @action(detail=True, methods=['get'])
    def service_usage(self, request, pk=None, *args, **kwargs):
        """
        ## Organization Usage Tracker
        <p>Tracks the total usage of different services for each account in an organization</p>
        <p>Tracks the submissions and NLP seconds/characters for the current month/year/all time</p>
        <p>Tracks the current total storage used</p>
        <p>If no organization is found with the provided ID, returns the usage for the logged-in user</p>
        <strong>This endpoint is cached for an amount of time determined by ENDPOINT_CACHE_DURATION</strong>

        <pre class="prettyprint">
        <b>GET</b> /api/v2/organizations/{organization_id}/service_usage/
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/organizations/{organization_id}/service_usage/
        >       {
        >           "total_nlp_usage": {
        >               "asr_seconds_current_month": {integer},
        >               "asr_seconds_current_year": {integer},
        >               "asr_seconds_all_time": {integer},
        >               "mt_characters_current_month": {integer},
        >               "mt_characters_current_year": {integer},
        >               "mt_characters_all_time": {integer},
        >           },
        >           "total_storage_bytes": {integer},
        >           "total_submission_count": {
        >               "current_month": {integer},
        >               "current_year": {integer},
        >               "all_time": {integer},
        >           },
        >           "current_month_start": {string (date), ISO format},
        >           "current_year_start": {string (date), ISO format},
        >           "billing_period_end": {string (date), ISO format}|{None},
        >       }
        ### CURRENT ENDPOINT
        """

        context = {
            'organization_id': kwargs.get('id', None),
            **self.get_serializer_context(),
        }

        serializer = ServiceUsageSerializer(
            get_database_user(request.user),
            context=context,
        )
        return Response(data=serializer.data)
