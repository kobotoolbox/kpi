from django.db.models import Q
from rest_framework import viewsets, status, exceptions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from django.utils import timezone

from kpi.models.user_report import UserReportMaterialized
from kpi.serializers.v2.user_report_serializer import (
    UserReportSerializer,
    UserReportFilterSerializer
)
from kpi.paginators import LimitStartPagination


class UserReportFilter:
    """
    Filter class for UserReport materialized view.
    Handles filtering on pre-computed fields efficiently.
    """

    def filter_queryset(self, request, queryset):
        # Get filter parameters
        filter_serializer = UserReportFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filters = filter_serializer.validated_data

        # Apply basic field filters (all from materialized view)
        if 'storage_bytes__total' in filters:
            queryset = queryset.filter(
                total_storage_bytes=filters['storage_bytes__total']
            )

        if 'storage_bytes__total__gte' in filters:
            queryset = queryset.filter(
                total_storage_bytes__gte=filters['storage_bytes__total__gte']
            )

        if 'storage_bytes__total__lte' in filters:
            queryset = queryset.filter(
                total_storage_bytes__lte=filters['storage_bytes__total__lte']
            )

        if 'date_joined' in filters:
            queryset = queryset.filter(date_joined=filters['date_joined'])

        if 'date_joined__gte' in filters:
            queryset = queryset.filter(date_joined__gte=filters['date_joined__gte'])

        if 'date_joined__lte' in filters:
            queryset = queryset.filter(date_joined__lte=filters['date_joined__lte'])

        if 'last_login' in filters:
            queryset = queryset.filter(last_login=filters['last_login'])

        if 'last_login__gte' in filters:
            queryset = queryset.filter(last_login__gte=filters['last_login__gte'])

        if 'last_login__lte' in filters:
            queryset = queryset.filter(last_login__lte=filters['last_login__lte'])

        if 'metadata__organization_type' in filters:
            queryset = queryset.filter(
                metadata_organization_type=filters['metadata__organization_type']
            )

        if 'email' in filters:
            queryset = queryset.filter(email__icontains=filters['email'])

        # Handle JSONB subscription filtering
        if 'subscriptions' in filters:
            subscription_filter = filters['subscriptions']
            queryset = queryset.extra(
                where=["subscriptions::jsonb @> %s"],
                params=[f'[{{"status": "{subscription_filter}"}}]']
            )

        if 'subscription_id' in filters:
            subscription_id = filters['subscription_id']
            queryset = queryset.extra(
                where=["subscriptions::jsonb @> %s"],
                params=[f'[{{"id": "{subscription_id}"}}]']
            )

        # Handle search across multiple fields
        if 'search' in filters:
            search_term = filters['search']
            queryset = queryset.filter(
                Q(username__icontains=search_term) |
                Q(email__icontains=search_term) |
                Q(first_name__icontains=search_term) |
                Q(last_name__icontains=search_term)
            )

        return queryset


class UserReportViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ## Filtering Options:
    - `storage_bytes__total__gte/lte`: Filter by storage usage range
    - `date_joined__gte/lte`: Filter by registration date range
    - `last_login__gte/lte`: Filter by last login date range
    - `metadata__organization_type`: Filter by organization type
    - `subscriptions`: Filter by subscription status
    - `subscription_id`: Filter by specific subscription ID
    - `email`: Search by email address
    - `search`: Search across username, email, first_name, last_name
    - `ordering`: Order results by field (use - prefix for descending)

    ## Examples:
    ```
    # Get users with high storage usage
    GET /api/v2/user-reports-optimized/?storage_bytes__total__gte=10000000

    # Get recently active users
    GET /api/v2/user-reports-optimized/?last_login__gte=2025-08-01&ordering=-last_login

    # Complex filtering
    GET /api/v2/user-reports-optimized/?storage_bytes__total__lte=50000000&metadata__organization_type=enterprise
    ```

    Note: Current period submission/NLP filters are not available for performance reasons.
    These values are calculated on-demand and cannot be efficiently filtered in SQL.
    """

    queryset = UserReportMaterialized.objects.all()
    serializer_class = UserReportSerializer
    pagination_class = LimitStartPagination
    permission_classes = [IsAuthenticated]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_report_filter = UserReportFilter()

    def get_queryset(self):
        """
        Get the base queryset and apply filters.
        """
        queryset = super().get_queryset()

        # Apply custom filtering (only on materialized view fields)
        queryset = self.user_report_filter.filter_queryset(self.request, queryset)

        # Apply ordering (only on materialized view fields)
        ordering = self.request.query_params.get('ordering', 'user_id')
        if ordering:
            queryset = queryset.order_by(ordering)

        return queryset

    def list(self, request, *args, **kwargs):
        # Only allow superusers to access this endpoint (same as your UserViewSet)
        if not request.user.is_superuser:
            raise exceptions.PermissionDenied()

        filtered_queryset = self.get_queryset()

        page = self.paginate_queryset(filtered_queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)

            return response
