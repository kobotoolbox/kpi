from django.conf import settings
from django.contrib import admin, messages
from django.db import transaction
from django.utils.html import format_html

from kobo.apps.openrosa.apps.main.models import UserProfile
from .filters import PasswordValidationAdvancedSearchFilter
from .mixins import AdvancedSearchMixin
from ..models import ExtraUserDetail


class PasswordValidationAdmin(AdvancedSearchMixin, admin.ModelAdmin):
    list_display = (
        'username',
        'date_joined',
        'last_login',
        'get_password_date_changed',
        'get_validated_password',
    )

    list_filter = (
        PasswordValidationAdvancedSearchFilter,
        'extra_details__validated_password',
        ('date_joined', admin.DateFieldListFilter),
        ('last_login', admin.DateFieldListFilter),
        ('extra_details__password_date_changed', admin.DateFieldListFilter),
    )

    ordering = ('username',)
    search_fields = ('username',)
    actions = ('validate_passwords', 'invalidate_passwords',)
    readonly_fields = ('username',)
    fieldsets = [
        (
            None,
            {
                'fields': (
                    'username',
                    'get_password_date_changed',
                    'get_validated_password',
                ),
            },
        ),
    ]
    search_default_field_lookups = [
        'username__icontains',
        'email__icontains',
    ]

    @admin.display(description='Last password change')
    def get_password_date_changed(self, obj):
        date_ = None
        try:
            date_ = obj.extra_details.password_date_changed
        except obj.extra_details.RelatedObjectDoesNotExist:
            pass

        return date_ if date_ else '-'

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .filter(is_active=True)
            .exclude(pk=settings.ANONYMOUS_USER_ID)
        )

    @admin.display(description='Validated')
    def get_validated_password(self, obj):
        value = False
        try:
            value = obj.extra_details.validated_password
        except obj.extra_details.RelatedObjectDoesNotExist:
            pass

        try:
            value = value and obj.profile.validated_password
        except obj.profile.RelatedObjectDoesNotExist:
            pass

        return format_html(
            '<img src="/static/admin/img/icon-{}.svg" alt="{}">',
            'yes' if value else 'no',
            value,
        )

    @admin.action(description='invalidate selected users’ password')
    def invalidate_passwords(self, request, queryset, **kwargs):
        with transaction.atomic():
            # Kobocat shadow models cannot work with KPI models.
            # We need to coerce the queryset to list of integers.
            user_ids = list(queryset.values_list('pk', flat=True))
            ExtraUserDetail.objects.filter(user_id__in=user_ids).update(
                validated_password=False
            )
            UserProfile.objects.bulk_create(
                [
                    UserProfile(user_id=user_id, validated_password=False)
                    for user_id in user_ids
                ],
                update_conflicts=True,
                unique_fields=['user_id'],
                update_fields=['validated_password'],
            )

        self.message_user(
            request,
            'Passwords have been invalidated successfully',
            messages.SUCCESS,
        )

    @admin.action(description='validate selected users’ password')
    def validate_passwords(self, request, queryset, **kwargs):
        with transaction.atomic():
            # Kobocat shadow models cannot work with KPI models.
            # We need to coerce the queryset to list of integers.
            user_ids = list(queryset.values_list('pk', flat=True))
            ExtraUserDetail.objects.filter(user_id__in=user_ids).update(
                validated_password=True
            )
            UserProfile.objects.bulk_create(
                [
                    UserProfile(user_id=user_id, validated_password=True)
                    for user_id in user_ids
                ],
                update_conflicts=True,
                unique_fields=['user_id'],
                update_fields=['validated_password'],
            )

        self.message_user(
            request,
            'Passwords have been validated successfully',
            messages.SUCCESS,
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
