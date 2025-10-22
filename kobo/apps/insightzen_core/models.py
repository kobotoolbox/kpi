from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class InsightUserProfile(models.Model):
    class Locale(models.TextChoices):
        FA = 'fa', _('Persian')
        EN = 'en', _('English')

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='insightzen_profile',
    )
    phone = models.CharField(max_length=64, blank=True)
    preferred_locale = models.CharField(
        max_length=5,
        choices=Locale.choices,
        default=Locale.FA,
    )
    timezone = models.CharField(max_length=64, default='Asia/Tehran')

    class Meta:
        verbose_name = _('InsightZen user profile')
        verbose_name_plural = _('InsightZen user profiles')

    def __str__(self) -> str:
        return f'{self.user.username} insight profile'


class InsightProject(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_PAUSED = 'paused'
    STATUS_ARCHIVED = 'archived'

    STATUS_CHOICES = (
        (STATUS_ACTIVE, _('Active')),
        (STATUS_PAUSED, _('Paused')),
        (STATUS_ARCHIVED, _('Archived')),
    )

    code = models.CharField(
        max_length=32,
        unique=True,
        validators=[
            RegexValidator(
                regex=r'^[a-z0-9-]+$',
                message=_('Project code may only include lowercase letters, numbers, and hyphens.'),
            )
        ],
    )
    name = models.CharField(max_length=256)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_insightzen_projects',
    )
    types = ArrayField(models.CharField(max_length=64), default=list, blank=True)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('InsightZen project')
        verbose_name_plural = _('InsightZen projects')
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['status']),
            GinIndex(fields=['types']),
        ]

    def __str__(self) -> str:
        return self.code


class InsightMembership(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_MANAGER = 'manager'
    ROLE_SUPERVISOR = 'supervisor'
    ROLE_AGENT = 'agent'
    ROLE_VIEWER = 'viewer'

    ROLE_CHOICES = (
        (ROLE_ADMIN, _('Admin')),
        (ROLE_MANAGER, _('Manager')),
        (ROLE_SUPERVISOR, _('Supervisor')),
        (ROLE_AGENT, _('Agent')),
        (ROLE_VIEWER, _('Viewer')),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='insight_memberships',
    )
    project = models.ForeignKey(
        InsightProject,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    title = models.CharField(max_length=128, blank=True)
    role = models.CharField(
        max_length=32,
        choices=ROLE_CHOICES,
        default=ROLE_VIEWER,
    )
    panel_permissions = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project')
        indexes = [
            models.Index(fields=['project', 'user']),
            models.Index(fields=['role']),
            GinIndex(fields=['panel_permissions']),
        ]
        verbose_name = _('InsightZen membership')
        verbose_name_plural = _('InsightZen memberships')

    def __str__(self) -> str:
        return f'{self.user} → {self.project}'


class QuotaScheme(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_ARCHIVED = 'archived'

    STATUS_CHOICES = (
        (STATUS_DRAFT, _('Draft')),
        (STATUS_PUBLISHED, _('Published')),
        (STATUS_ARCHIVED, _('Archived')),
    )

    OVERFLOW_STRICT = 'strict'
    OVERFLOW_SOFT = 'soft'
    OVERFLOW_WEIGHTED = 'weighted'

    OVERFLOW_CHOICES = (
        (OVERFLOW_STRICT, _('Strict')),
        (OVERFLOW_SOFT, _('Soft')),
        (OVERFLOW_WEIGHTED, _('Weighted')),
    )

    project = models.ForeignKey(
        InsightProject,
        on_delete=models.CASCADE,
        related_name='quota_schemes',
    )
    name = models.CharField(max_length=128)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )
    dimensions = models.JSONField(default=list)
    overflow_policy = models.CharField(
        max_length=16,
        choices=OVERFLOW_CHOICES,
        default=OVERFLOW_STRICT,
    )
    priority = models.IntegerField(default=0)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Quota scheme')
        verbose_name_plural = _('Quota schemes')
        unique_together = ('project', 'name', 'version')
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['project', 'is_default']),
            models.Index(fields=['priority', 'published_at']),
        ]

    def __str__(self) -> str:
        return f'{self.project.code} :: {self.name} v{self.version}'

    def mark_published(self) -> None:
        self.status = self.STATUS_PUBLISHED
        if not self.published_at:
            self.published_at = timezone.now()
        self.save(update_fields=['status', 'published_at'])


class QuotaCell(models.Model):
    scheme = models.ForeignKey(
        QuotaScheme,
        on_delete=models.CASCADE,
        related_name='cells',
    )
    selector = models.JSONField()
    label = models.CharField(max_length=256, blank=True)
    target = models.PositiveIntegerField()
    soft_cap = models.PositiveIntegerField(null=True, blank=True)
    weight = models.FloatField(default=1.0)
    achieved = models.PositiveIntegerField(default=0)
    in_progress = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Quota cell')
        verbose_name_plural = _('Quota cells')
        constraints = [
            models.UniqueConstraint(
                fields=['scheme', 'selector'],
                name='unique_quota_cell_selector',
            ),
        ]
        indexes = [
            models.Index(fields=['scheme']),
        ]

    def remaining(self) -> int:
        if self.soft_cap:
            return max(self.soft_cap - self.achieved, 0)
        return max(self.target - self.achieved, 0)


class SampleContact(models.Model):
    project = models.ForeignKey(
        InsightProject,
        on_delete=models.CASCADE,
        related_name='samples',
    )
    phone = models.CharField(max_length=32, db_index=True)
    gender = models.CharField(max_length=16, null=True, blank=True)
    age_band = models.CharField(max_length=16, null=True, blank=True)
    province_code = models.CharField(max_length=4, null=True, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Sample contact')
        verbose_name_plural = _('Sample contacts')
        indexes = [
            models.Index(fields=['project', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.phone} ({self.project.code})'


class DialerAssignment(models.Model):
    STATUS_RESERVED = 'reserved'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = (
        (STATUS_RESERVED, _('Reserved')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_FAILED, _('Failed')),
        (STATUS_EXPIRED, _('Expired')),
        (STATUS_CANCELLED, _('Cancelled')),
    )

    project = models.ForeignKey(
        InsightProject,
        on_delete=models.CASCADE,
        related_name='assignments',
    )
    scheme = models.ForeignKey(
        QuotaScheme,
        on_delete=models.PROTECT,
        related_name='+',
    )
    cell = models.ForeignKey(
        QuotaCell,
        on_delete=models.PROTECT,
        related_name='assignments',
    )
    interviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='quota_assignments',
    )
    sample = models.ForeignKey(
        SampleContact,
        on_delete=models.PROTECT,
        related_name='assignments',
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_RESERVED,
    )
    reserved_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    outcome_code = models.CharField(max_length=8, null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('Dialer assignment')
        verbose_name_plural = _('Dialer assignments')
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['cell', 'status']),
            models.Index(fields=['sample', 'status']),
        ]

    def __str__(self) -> str:
        return f'{self.project.code} → {self.sample.phone} ({self.status})'
