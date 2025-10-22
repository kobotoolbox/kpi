from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import (
    DialerAssignment,
    InsightMembership,
    InsightProject,
    InsightUserProfile,
    QuotaCell,
    QuotaScheme,
)

User = get_user_model()


class InsightUserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsightUserProfile
        fields = ('phone', 'preferred_locale', 'timezone')


class InsightMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsightMembership
        fields = (
            'id',
            'user',
            'project',
            'title',
            'role',
            'panel_permissions',
            'is_active',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')


class InsightMembershipBriefSerializer(serializers.ModelSerializer):
    project_code = serializers.CharField(source='project.code', read_only=True)

    class Meta:
        model = InsightMembership
        fields = ('project_id', 'project_code', 'role')
        read_only_fields = fields


class InsightProjectSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    memberships = InsightMembershipSerializer(many=True, required=False)

    class Meta:
        model = InsightProject
        fields = (
            'id',
            'code',
            'name',
            'description',
            'owner',
            'owner_name',
            'types',
            'status',
            'start_date',
            'end_date',
            'memberships',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
        extra_kwargs = {'owner': {'required': False}}

    def validate_code(self, value: str) -> str:
        code = value.strip().lower()
        if not code:
            raise serializers.ValidationError(_('Project code is required.'))
        return code

    def validate_types(self, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in value:
            label = (raw or '').strip()
            if not label:
                continue
            normalized = label.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(label)
        return cleaned

    def create(self, validated_data: dict[str, Any]) -> InsightProject:
        memberships_data = validated_data.pop('memberships', [])
        with transaction.atomic():
            project = super().create(validated_data)
            self._sync_memberships(project, memberships_data)
        return project

    def update(self, instance: InsightProject, validated_data: dict[str, Any]) -> InsightProject:
        memberships_data = validated_data.pop('memberships', None)
        with transaction.atomic():
            project = super().update(instance, validated_data)
            if memberships_data is not None:
                self._sync_memberships(project, memberships_data)
        return project

    def _sync_memberships(
        self,
        project: InsightProject,
        memberships_data: list[dict[str, Any]],
    ) -> None:
        seen_ids: set[int] = set()
        for membership_data in memberships_data:
            membership_id = membership_data.get('id')
            defaults = {
                'title': membership_data.get('title', ''),
                'role': membership_data.get('role', InsightMembership.ROLE_VIEWER),
                'panel_permissions': membership_data.get('panel_permissions', {}),
                'is_active': membership_data.get('is_active', True),
            }
            if membership_id:
                InsightMembership.objects.filter(id=membership_id, project=project).update(
                    **defaults,
                )
                seen_ids.add(membership_id)
            else:
                membership, _created = InsightMembership.objects.update_or_create(
                    project=project,
                    user_id=membership_data['user'],
                    defaults=defaults,
                )
                seen_ids.add(membership.id)
        if seen_ids:
            InsightMembership.objects.filter(project=project).exclude(id__in=seen_ids).delete()


class InsightProjectListSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    member_count = serializers.IntegerField(source='memberships.count', read_only=True)

    class Meta:
        model = InsightProject
        fields = (
            'id',
            'code',
            'name',
            'owner',
            'owner_name',
            'types',
            'status',
            'start_date',
            'end_date',
            'member_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class InsightUserSerializer(serializers.ModelSerializer):
    insight_profile = InsightUserProfileSerializer(
        required=False, allow_null=True, source='insightzen_profile'
    )
    memberships_brief = InsightMembershipBriefSerializer(
        many=True,
        read_only=True,
        source='insight_memberships',
    )

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'is_staff',
            'insight_profile',
            'memberships_brief',
        )
        read_only_fields = ('id', 'is_staff', 'memberships_brief')

    def create(self, validated_data: dict[str, Any]) -> User:
        profile_data = validated_data.pop('insightzen_profile', None)
        with transaction.atomic():
            user = User.objects.create(**validated_data)
            user.set_unusable_password()
            user.save(update_fields=['password'])
            self._update_profile(user, profile_data)
        return user

    def update(self, instance: User, validated_data: dict[str, Any]) -> User:
        profile_data = validated_data.pop('insightzen_profile', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._update_profile(instance, profile_data)
        return instance

    def _update_profile(self, user: User, profile_data: dict[str, Any] | None) -> None:
        if profile_data is None:
            return
        InsightUserProfile.objects.update_or_create(user=user, defaults=profile_data)


class InsightUserDetailSerializer(InsightUserSerializer):
    memberships = InsightMembershipSerializer(
        many=True,
        read_only=True,
        source='insight_memberships',
    )

    class Meta(InsightUserSerializer.Meta):
        fields = InsightUserSerializer.Meta.fields + ('memberships',)


class QuotaDimensionSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField(required=False, allow_blank=True)
    type = serializers.ChoiceField(
        choices=(
            ('categorical', 'categorical'),
            ('numeric', 'numeric'),
            ('text', 'text'),
        ),
        default='categorical',
    )
    values = serializers.ListField(child=serializers.JSONField(), allow_empty=False)
    required = serializers.BooleanField(default=False)


class QuotaSchemeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    project_code = serializers.CharField(source='project.code', read_only=True)
    cell_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = QuotaScheme
        fields = (
            'id',
            'project',
            'project_code',
            'name',
            'version',
            'status',
            'dimensions',
            'overflow_policy',
            'priority',
            'is_default',
            'created_by',
            'created_by_name',
            'created_at',
            'published_at',
            'cell_count',
        )
        read_only_fields = (
            'id',
            'created_by',
            'created_by_name',
            'created_at',
            'published_at',
            'cell_count',
            'project_code',
        )

    def validate_dimensions(self, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        serializer = QuotaDimensionSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        seen_keys: set[str] = set()
        for dim in serializer.validated_data:
            key = dim['key']
            if key in seen_keys:
                raise serializers.ValidationError(_('Dimension keys must be unique.'))
            seen_keys.add(key)
        return serializer.validated_data

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        instance: QuotaScheme | None = getattr(self, 'instance', None)
        status_value = attrs.get('status', instance.status if instance else QuotaScheme.STATUS_DRAFT)
        if instance and instance.status == QuotaScheme.STATUS_PUBLISHED and 'dimensions' in attrs:
            raise serializers.ValidationError(_('Published schemes cannot change dimensions. Create a new version.'))
        if instance and instance.status == QuotaScheme.STATUS_ARCHIVED:
            raise serializers.ValidationError(_('Archived schemes are read-only.'))
        if status_value not in dict(QuotaScheme.STATUS_CHOICES):
            raise serializers.ValidationError({'status': _('Invalid status.')})
        return attrs

    def create(self, validated_data: dict[str, Any]) -> QuotaScheme:
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)

    def update(self, instance: QuotaScheme, validated_data: dict[str, Any]) -> QuotaScheme:
        is_default = validated_data.get('is_default')
        scheme = super().update(instance, validated_data)
        if is_default:
            QuotaScheme.objects.filter(project=scheme.project).exclude(pk=scheme.pk).update(is_default=False)
        return scheme


class QuotaCellSerializer(serializers.ModelSerializer):
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = QuotaCell
        fields = (
            'id',
            'scheme',
            'selector',
            'label',
            'target',
            'soft_cap',
            'weight',
            'achieved',
            'in_progress',
            'reserved',
            'remaining',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'scheme',
            'achieved',
            'in_progress',
            'reserved',
            'remaining',
            'updated_at',
        )

    def get_remaining(self, obj: QuotaCell) -> int:
        return obj.remaining()


class QuotaCellUpsertSerializer(serializers.Serializer):
    selector = serializers.DictField(child=serializers.JSONField())
    label = serializers.CharField(required=False, allow_blank=True)
    target = serializers.IntegerField(min_value=0)
    soft_cap = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    weight = serializers.FloatField(required=False, min_value=0.0)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        soft_cap = attrs.get('soft_cap')
        target = attrs['target']
        if soft_cap is not None and soft_cap < target:
            raise serializers.ValidationError(_('Soft cap cannot be lower than target.'))
        return attrs


class QuotaSchemeStatsSerializer(serializers.Serializer):
    target = serializers.IntegerField()
    achieved = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    remaining = serializers.IntegerField()


class DialerAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DialerAssignment
        fields = (
            'id',
            'project',
            'scheme',
            'cell',
            'interviewer',
            'sample',
            'status',
            'reserved_at',
            'expires_at',
            'completed_at',
            'outcome_code',
            'meta',
        )
        read_only_fields = fields


class DialerNextRequestSerializer(serializers.Serializer):
    project = serializers.IntegerField()
    scheme_id = serializers.IntegerField(required=False)


class DialerCompleteSerializer(serializers.Serializer):
    assignment_id = serializers.IntegerField()
    outcome_code = serializers.CharField(max_length=8)
    submit_payload = serializers.JSONField(required=False)


class DialerCancelSerializer(serializers.Serializer):
    assignment_id = serializers.IntegerField()
