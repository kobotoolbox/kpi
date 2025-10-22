from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import (
    MembershipFilterSet,
    ProjectFilterSet,
    QuotaCellFilterSet,
    QuotaSchemeFilterSet,
    UserFilterSet,
)
from .models import (
    DialerAssignment,
    InsightMembership,
    InsightProject,
    QuotaCell,
    QuotaScheme,
    SampleContact,
)
from .permissions import IsInsightZenAdminOrReadOnly
from .serializers import (
    DialerAssignmentSerializer,
    DialerCancelSerializer,
    DialerCompleteSerializer,
    DialerNextRequestSerializer,
    InsightMembershipSerializer,
    InsightProjectListSerializer,
    InsightProjectSerializer,
    InsightUserDetailSerializer,
    InsightUserSerializer,
    QuotaCellSerializer,
    QuotaCellUpsertSerializer,
    QuotaSchemeSerializer,
    QuotaSchemeStatsSerializer,
)

User = get_user_model()


class InsightZenAccessMixin:
    def _accessible_project_ids(self) -> Iterable[int]:
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return InsightProject.objects.values_list('id', flat=True)
        return InsightMembership.objects.filter(
            user=user,
            is_active=True,
        ).values_list('project_id', flat=True)

    def _require_project_admin(self, project_id: int) -> None:
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return
        if not InsightMembership.objects.filter(
            user=user,
            project_id=project_id,
            is_active=True,
            role__in=[InsightMembership.ROLE_ADMIN, InsightMembership.ROLE_MANAGER],
        ).exists():
            self.permission_denied(self.request, message='Insufficient project permissions.')

    def _require_project_roles(self, project_id: int, roles: list[str]) -> None:
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return
        if not InsightMembership.objects.filter(
            user=user,
            project_id=project_id,
            is_active=True,
            role__in=roles,
        ).exists():
            self.permission_denied(self.request, message='Insufficient project permissions.')


class InsightProjectViewSet(InsightZenAccessMixin, viewsets.ModelViewSet):
    queryset = InsightProject.objects.all()
    serializer_class = InsightProjectSerializer
    permission_classes = [IsAuthenticated, IsInsightZenAdminOrReadOnly]
    filterset_class = ProjectFilterSet
    ordering_fields = ['code', 'name', 'status', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = (
            InsightProject.objects.annotate(member_count=Count('memberships'))
            .select_related('owner')
            .prefetch_related(
                Prefetch(
                    'memberships',
                    queryset=InsightMembership.objects.select_related('user'),
                )
            )
        )
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return queryset
        return queryset.filter(id__in=self._accessible_project_ids())

    def get_serializer_class(self):
        if self.action == 'list':
            return InsightProjectListSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        owner = serializer.validated_data.get('owner', self.request.user)
        if owner != self.request.user and not (
            self.request.user.is_superuser or self.request.user.is_staff
        ):
            self.permission_denied(self.request, message='Only staff can assign other owners.')
        serializer.save(owner=owner)

    def perform_update(self, serializer):
        instance = serializer.instance
        self._require_project_admin(instance.pk)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_project_admin(instance.pk)
        instance.status = InsightProject.STATUS_ARCHIVED
        instance.save(update_fields=['status'])

    @action(detail=True, methods=['get', 'post'], url_path='memberships')
    def memberships(self, request, pk=None):  # noqa: D401
        """Manage memberships nested under a project."""
        project = self.get_object()
        if request.method == 'GET':
            serializer = InsightMembershipSerializer(project.memberships.all(), many=True)
            return Response(serializer.data)
        self._require_project_admin(project.pk)
        serializer = InsightMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='memberships/(?P<membership_id>[^/.]+)')
    def membership_detail(self, request, pk=None, membership_id=None):
        project = self.get_object()
        membership = get_object_or_404(project.memberships, pk=membership_id)
        self._require_project_admin(project.pk)
        if request.method == 'PATCH':
            serializer = InsightMembershipSerializer(
                membership, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InsightUserViewSet(InsightZenAccessMixin, viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = InsightUserSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = UserFilterSet
    ordering_fields = ['username', 'first_name', 'last_name', 'email']
    ordering = ['username']

    def get_queryset(self):
        queryset = (
            User.objects.select_related('insightzen_profile')
            .prefetch_related(
                Prefetch(
                    'insight_memberships',
                    queryset=InsightMembership.objects.select_related('project'),
                )
            )
            .all()
        )
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return queryset
        return queryset.filter(insight_memberships__project_id__in=self._accessible_project_ids()).distinct()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return InsightUserDetailSerializer
        return super().get_serializer_class()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=True, methods=['get', 'post'], url_path='memberships')
    def memberships(self, request, pk=None):
        user = self.get_object()
        if request.method == 'GET':
            serializer = InsightMembershipSerializer(user.insight_memberships.all(), many=True)
            return Response(serializer.data)
        project_id = request.data.get('project')
        if not project_id:
            return Response({'detail': 'project is required'}, status=status.HTTP_400_BAD_REQUEST)
        self._require_project_admin(int(project_id))
        serializer = InsightMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['patch', 'delete'],
        url_path='memberships/(?P<membership_id>[^/.]+)'
    )
    def membership_detail(self, request, pk=None, membership_id=None):
        user = self.get_object()
        membership = get_object_or_404(user.insight_memberships, pk=membership_id)
        self._require_project_admin(membership.project_id)
        if request.method == 'PATCH':
            serializer = InsightMembershipSerializer(
                membership, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuotaSchemeViewSet(InsightZenAccessMixin, viewsets.ModelViewSet):
    queryset = QuotaScheme.objects.all()
    serializer_class = QuotaSchemeSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotaSchemeFilterSet
    ordering_fields = ['priority', 'created_at', 'published_at', 'name']
    ordering = ['-priority', '-created_at']

    def get_queryset(self):
        queryset = (
            QuotaScheme.objects.select_related('project', 'created_by')
            .annotate(cell_count=Count('cells'))
            .all()
        )
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return queryset
        return queryset.filter(project_id__in=self._accessible_project_ids())

    def perform_create(self, serializer):
        project = serializer.validated_data['project']
        self._require_project_admin(project.pk)
        is_default = serializer.validated_data.get('is_default')
        scheme = serializer.save()
        if is_default:
            QuotaScheme.objects.filter(project=project).exclude(pk=scheme.pk).update(is_default=False)

    def perform_update(self, serializer):
        scheme = serializer.instance
        self._require_project_admin(scheme.project_id)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._require_project_admin(instance.project_id)
        instance.status = QuotaScheme.STATUS_ARCHIVED
        instance.save(update_fields=['status'])

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        scheme = self.get_object()
        self._require_project_admin(scheme.project_id)
        if scheme.status == QuotaScheme.STATUS_ARCHIVED:
            return Response({'detail': 'Archived schemes cannot be published.'}, status=status.HTTP_400_BAD_REQUEST)
        scheme.mark_published()
        return Response(self.get_serializer(scheme).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        scheme = self.get_object()
        self._require_project_admin(scheme.project_id)
        scheme.status = QuotaScheme.STATUS_ARCHIVED
        scheme.save(update_fields=['status'])
        return Response(self.get_serializer(scheme).data)

    @action(detail=True, methods=['get'], url_path='cells')
    def cells(self, request, pk=None):
        scheme = self.get_object()
        if not self._has_access_to_scheme(scheme):
            self.permission_denied(request, message='Insufficient project permissions.')
        query_params = request.query_params.copy()
        query_params['scheme'] = scheme.pk
        filterset = QuotaCellFilterSet(query_params, queryset=scheme.cells.all())
        if not filterset.is_valid():
            return Response(filterset.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer = QuotaCellSerializer(filterset.qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='cells/bulk-upsert')
    def bulk_upsert_cells(self, request, pk=None):
        scheme = self.get_object()
        self._require_project_admin(scheme.project_id)
        if scheme.status != QuotaScheme.STATUS_DRAFT:
            self.permission_denied(request, message='Scheme is read-only.')
        serializer = QuotaCellUpsertSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        cells_data = serializer.validated_data
        with transaction.atomic():
            for cell_data in cells_data:
                selector = cell_data['selector']
                defaults = {
                    'label': cell_data.get('label', ''),
                    'target': cell_data['target'],
                    'soft_cap': cell_data.get('soft_cap'),
                    'weight': cell_data.get('weight', 1.0),
                }
                QuotaCell.objects.update_or_create(
                    scheme=scheme,
                    selector=selector,
                    defaults=defaults,
                )
        refreshed = QuotaCellSerializer(scheme.cells.all(), many=True)
        return Response(refreshed.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        scheme = self.get_object()
        if not self._has_access_to_scheme(scheme):
            self.permission_denied(request, message='Insufficient project permissions.')
        aggregates = scheme.cells.aggregate(
            target=Sum('target'),
            achieved=Sum('achieved'),
            in_progress=Sum('in_progress'),
        )
        remaining = sum(cell.remaining() for cell in scheme.cells.all())
        payload = {
            'target': aggregates['target'] or 0,
            'achieved': aggregates['achieved'] or 0,
            'in_progress': aggregates['in_progress'] or 0,
            'remaining': remaining,
        }
        serializer = QuotaSchemeStatsSerializer(payload)
        return Response(serializer.data)

    def _has_access_to_scheme(self, scheme: QuotaScheme) -> bool:
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return True
        return InsightMembership.objects.filter(
            user=user,
            project=scheme.project,
            is_active=True,
        ).exists()


class QuotaCellViewSet(InsightZenAccessMixin, mixins.UpdateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = QuotaCell.objects.select_related('scheme', 'scheme__project')
    serializer_class = QuotaCellSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotaCellFilterSet

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return queryset
        return queryset.filter(scheme__project_id__in=self._accessible_project_ids())

    def perform_update(self, serializer):
        cell = serializer.instance
        if cell.scheme.status != QuotaScheme.STATUS_DRAFT:
            self.permission_denied(self.request, message='Scheme is read-only.')
        self._require_project_admin(cell.scheme.project_id)
        serializer.save()


class InsightMembershipViewSet(InsightZenAccessMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = InsightMembership.objects.select_related('user', 'project')
    serializer_class = InsightMembershipSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = MembershipFilterSet

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return queryset
        return queryset.filter(project_id__in=self._accessible_project_ids())


class DialerBaseView(InsightZenAccessMixin, APIView):
    permission_classes = [IsAuthenticated]
    ttl_minutes = 15
    allowed_roles = [
        InsightMembership.ROLE_ADMIN,
        InsightMembership.ROLE_MANAGER,
        InsightMembership.ROLE_SUPERVISOR,
        InsightMembership.ROLE_AGENT,
    ]

    def _get_scheme(self, project_id: int, scheme_id: int | None) -> QuotaScheme | None:
        queryset = QuotaScheme.objects.filter(project_id=project_id, status=QuotaScheme.STATUS_PUBLISHED)
        if scheme_id:
            return queryset.filter(pk=scheme_id).first()
        return queryset.order_by('-priority', '-published_at').first()


class DialerNextView(DialerBaseView):
    def post(self, request):
        serializer = DialerNextRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project_id = serializer.validated_data['project']
        scheme_id = serializer.validated_data.get('scheme_id')
        self._require_project_roles(project_id, self.allowed_roles)
        scheme = self._get_scheme(project_id, scheme_id)
        if not scheme:
            return Response({'detail': 'No published quota scheme available.'}, status=status.HTTP_404_NOT_FOUND)
        assignment = self._reserve_next_assignment(scheme, request.user)
        if not assignment:
            return Response({'detail': 'no_eligible_cell_or_sample'}, status=status.HTTP_404_NOT_FOUND)
        payload = {
            'assignment_id': assignment.id,
            'expires_at': assignment.expires_at,
            'sample': {
                'phone': assignment.sample.phone,
                'gender': assignment.sample.gender,
                'age_band': assignment.sample.age_band,
                'province_code': assignment.sample.province_code,
            },
            'cell': {
                'id': assignment.cell_id,
                'label': assignment.cell.label,
            },
            'scheme': {'id': scheme.id, 'name': scheme.name},
        }
        return Response(payload, status=status.HTTP_200_OK)

    def _reserve_next_assignment(self, scheme: QuotaScheme, interviewer) -> DialerAssignment | None:
        cells = list(
            scheme.cells.filter(target__gt=F('achieved')).order_by('-weight', 'achieved')
        )
        if scheme.overflow_policy == QuotaScheme.OVERFLOW_SOFT:
            cells = [
                cell
                for cell in cells
                if cell.soft_cap is None or cell.achieved < cell.soft_cap
            ]
        elif scheme.overflow_policy == QuotaScheme.OVERFLOW_WEIGHTED:
            cells.sort(
                key=lambda cell: cell.weight * max(cell.target - (cell.achieved + cell.in_progress), 0),
                reverse=True,
            )
        if not cells:
            return None
        for cell in cells:
            with transaction.atomic():
                locked_cell = QuotaCell.objects.select_for_update().get(pk=cell.pk)
                if locked_cell.target <= locked_cell.achieved:
                    continue
                if (
                    scheme.overflow_policy == QuotaScheme.OVERFLOW_SOFT
                    and locked_cell.soft_cap is not None
                    and locked_cell.achieved >= locked_cell.soft_cap
                ):
                    continue
                sample = self._pick_sample_for_cell(scheme.project, locked_cell)
                if not sample:
                    continue
                assignment = DialerAssignment.objects.create(
                    project=scheme.project,
                    scheme=scheme,
                    cell=locked_cell,
                    interviewer=interviewer,
                    sample=sample,
                    expires_at=timezone.now() + timedelta(minutes=self.ttl_minutes),
                )
                QuotaCell.objects.filter(pk=locked_cell.pk).update(
                    in_progress=F('in_progress') + 1,
                    reserved=F('reserved') + 1,
                )
                sample.used_at = timezone.now()
                sample.save(update_fields=['used_at'])
                return assignment
        return None

    def _pick_sample_for_cell(self, project: InsightProject, cell: QuotaCell) -> SampleContact | None:
        filters = {'project': project, 'is_active': True}
        selector = cell.selector or {}
        for key, value in selector.items():
            filters[key] = value
        reserved_assignments = DialerAssignment.objects.filter(
            sample_id=OuterRef('pk'),
            status=DialerAssignment.STATUS_RESERVED,
        )
        return (
            SampleContact.objects.select_for_update(skip_locked=True)
            .filter(**filters)
            .annotate(has_reservation=Exists(reserved_assignments))
            .filter(has_reservation=False)
            .order_by('used_at', 'pk')
            .first()
        )


class DialerCompleteView(DialerBaseView):
    def post(self, request):
        serializer = DialerCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = get_object_or_404(DialerAssignment, pk=serializer.validated_data['assignment_id'])
        self._require_project_roles(assignment.project_id, self.allowed_roles)
        with transaction.atomic():
            assignment = DialerAssignment.objects.select_for_update().get(pk=assignment.pk)
            if assignment.status != DialerAssignment.STATUS_RESERVED:
                return Response(DialerAssignmentSerializer(assignment).data)
            outcome = serializer.validated_data['outcome_code']
            assignment.status = (
                DialerAssignment.STATUS_COMPLETED if outcome.upper() == 'COMP' else DialerAssignment.STATUS_FAILED
            )
            assignment.outcome_code = outcome
            assignment.completed_at = timezone.now()
            assignment.meta = serializer.validated_data.get('submit_payload', {})
            assignment.save(update_fields=['status', 'outcome_code', 'completed_at', 'meta'])
            if assignment.status == DialerAssignment.STATUS_COMPLETED:
                QuotaCell.objects.filter(pk=assignment.cell_id).update(
                    achieved=F('achieved') + 1,
                    in_progress=F('in_progress') - 1,
                    reserved=F('reserved') - 1,
                )
            else:
                QuotaCell.objects.filter(pk=assignment.cell_id).update(
                    in_progress=F('in_progress') - 1,
                    reserved=F('reserved') - 1,
                )
        return Response(DialerAssignmentSerializer(assignment).data)


class DialerCancelView(DialerBaseView):
    def post(self, request):
        serializer = DialerCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = get_object_or_404(DialerAssignment, pk=serializer.validated_data['assignment_id'])
        self._require_project_roles(assignment.project_id, self.allowed_roles)
        with transaction.atomic():
            assignment = DialerAssignment.objects.select_for_update().get(pk=assignment.pk)
            if assignment.status != DialerAssignment.STATUS_RESERVED:
                return Response(DialerAssignmentSerializer(assignment).data)
            assignment.status = DialerAssignment.STATUS_CANCELLED
            assignment.completed_at = timezone.now()
            assignment.save(update_fields=['status', 'completed_at'])
            QuotaCell.objects.filter(pk=assignment.cell_id).update(
                in_progress=F('in_progress') - 1,
                reserved=F('reserved') - 1,
            )
        return Response(DialerAssignmentSerializer(assignment).data)
