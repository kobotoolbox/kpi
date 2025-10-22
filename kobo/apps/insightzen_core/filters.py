from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import F, Q
from django_filters import rest_framework as filters

from .models import InsightMembership, InsightProject, QuotaCell, QuotaScheme

User = get_user_model()


class UserFilterSet(filters.FilterSet):
    q = filters.CharFilter(method='filter_q')
    is_active = filters.BooleanFilter()
    role = filters.CharFilter(method='filter_role')
    project_id = filters.NumberFilter(method='filter_project')

    class Meta:
        model = User
        fields = ['q', 'is_active', 'role', 'project_id']

    def filter_q(self, queryset, name, value):  # noqa: D401
        """Filter users by a fuzzy match against username and contact details."""
        if not value:
            return queryset
        value = value.strip()
        lookup = (
            Q(username__icontains=value)
            | Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
            | Q(email__icontains=value)
        )
        return queryset.filter(lookup)

    def filter_role(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(insight_memberships__role=value).distinct()

    def filter_project(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(insight_memberships__project_id=value).distinct()


class ProjectFilterSet(filters.FilterSet):
    q = filters.CharFilter(method='filter_q')
    status = filters.CharFilter()
    owner_id = filters.NumberFilter(field_name='owner_id')
    type = filters.CharFilter(method='filter_type')

    class Meta:
        model = InsightProject
        fields = ['q', 'status', 'owner_id', 'type']

    def filter_q(self, queryset, name, value):
        if not value:
            return queryset
        value = value.strip()
        return queryset.filter(
            Q(name__icontains=value) | Q(code__icontains=value)
        )

    def filter_type(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(types__icontains=[value])


class MembershipFilterSet(filters.FilterSet):
    user_id = filters.NumberFilter(field_name='user_id')
    project_id = filters.NumberFilter(field_name='project_id')
    role = filters.CharFilter(field_name='role')

    class Meta:
        model = InsightMembership
        fields = ['user_id', 'project_id', 'role']


class QuotaSchemeFilterSet(filters.FilterSet):
    project = filters.NumberFilter(field_name='project_id')
    status = filters.CharFilter(field_name='status')
    q = filters.CharFilter(method='filter_q')

    class Meta:
        model = QuotaScheme
        fields = ['project', 'status', 'q']

    def filter_q(self, queryset, name, value):
        if not value:
            return queryset
        value = value.strip()
        return queryset.filter(Q(name__icontains=value) | Q(project__code__icontains=value))


class QuotaCellFilterSet(filters.FilterSet):
    scheme = filters.NumberFilter(field_name='scheme_id')
    complete = filters.BooleanFilter(method='filter_complete')

    class Meta:
        model = QuotaCell
        fields = ['scheme', 'complete']

    def filter_complete(self, queryset, name, value):
        if value is None:
            return queryset
        if value:
            return queryset.filter(achieved__gte=F('target'))
        return queryset.filter(achieved__lt=F('target'))
