# coding: utf-8
import mimetypes

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import get_default_password_validators
from django.core.exceptions import FieldError, ValidationError
from django.db import models
from django.db.models.signals import post_save
from django.http import FileResponse, HttpResponse, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.http import http_date
from markitup.fields import MarkupField

# `was_modified_since` is undocumented(?) but used by django-private-storage,
# whose approach is emulated here
from django.views.static import was_modified_since

from kpi.deployment_backends.kc_access.shadow_models import KobocatUserProfile
from kpi.fields import KpiUidField
from kpi.mixins import StandardizeSearchableFieldMixin
from kpi.utils.object_permission import get_database_user


def _configuration_file_upload_to(instance, filename):
    if instance.slug == ConfigurationFileSlug.COMMON_PASSWORDS_FILE:
        # Void lru cache to reload the file at the next password validation.
        get_default_password_validators.cache_clear()
        return f'__django_files/{instance.slug}/{filename}'

    return f'{settings.PUBLIC_MEDIA_PATH}/{instance.slug}/{filename}'


class SitewideMessage(models.Model):
    slug = models.CharField(max_length=50)
    body = MarkupField()

    def __str__(self):
        return self.slug


class ConfigurationFileSlug(models.TextChoices):

    LOGO = 'logo', 'Logo'
    LOGO_SMALL = 'logo_small', 'Small Logo'
    LOGIN_BACKGROUND = 'login_background', 'Login background'
    COMMON_PASSWORDS_FILE = 'common_passwords_file', 'Common passwords file'


class ConfigurationFile(models.Model):

    slug = models.CharField(
        max_length=32, choices=ConfigurationFileSlug.choices, unique=True
    )
    content = models.FileField(
        upload_to=_configuration_file_upload_to,
        help_text=(
            'Stored in a PUBLIC location where authentication is NOT required '
            '**to** access common passwords file.'
        ),
    )

    def __str__(self):
        return self.slug

    @classmethod
    def content_view(cls, request, slug):
        """
        Serve the content directly, without redirecting, to avoid problems with
        CSP. Heavily inspired by and borrows from django-private-storage,
        specifically `private_storage.servers.DjangoStreamingServer`
        """
        content = get_object_or_404(cls, slug=slug).content
        mimetype = (
            mimetypes.guess_type(content.name)[0] or 'application/octet-stream'
        )
        size = content.storage.size(content.name)
        mtime = content.storage.get_modified_time(content.name).timestamp()

        if not was_modified_since(
            request.META.get('HTTP_IF_MODIFIED_SINCE'), mtime, size
        ):
            return HttpResponseNotModified()

        if request.method == 'HEAD':
            response = HttpResponse()
        else:
            response = FileResponse(content.open())

        response['Content-Type'] = mimetype
        response['Content-Length'] = size
        response['Last-Modified'] = http_date(mtime)
        return response

    @property
    def url(self):
        return reverse('configurationfile', kwargs={'slug': self.slug})


class PerUserSetting(models.Model):
    """
    A configuration setting that has different values depending on whether not
    a user matches certain criteria
    """
    user_queries = models.JSONField(
        help_text='A JSON representation of a *list* of Django queries, '
                  'e.g. `[{"email__iendswith": "@kobotoolbox.org"}, '
                  '{"email__iendswith": "@kbtdev.org"}]`. '
                  'A matching user is one who would be returned by ANY of '
                  'the queries in the list.'
    )
    name = models.CharField(max_length=255, unique=True,
                            default='INTERCOM_APP_ID')  # Not used
    value_when_matched = models.CharField(max_length=2048, blank=True)
    value_when_not_matched = models.CharField(max_length=2048, blank=True)

    def user_matches(self, user, ignore_invalid_queries=True):
        user = get_database_user(user)
        manager = user._meta.model.objects
        queryset = manager.none()
        for user_query in self.user_queries:
            try:
                queryset |= manager.filter(**user_query)
            except (FieldError, TypeError):
                if ignore_invalid_queries:
                    return False
                else:
                    raise
        return queryset.filter(pk=user.pk).exists()

    def get_for_user(self, user):
        if self.user_matches(user):
            return self.value_when_matched
        else:
            return self.value_when_not_matched

    def clean(self):
        user = User.objects.first()
        if not user:
            return
        try:
            self.user_matches(user, ignore_invalid_queries=False)
        except FieldError as e:
            raise ValidationError({'user_queries': e.message})
        except TypeError:
            raise ValidationError(
                {'user_queries': 'JSON structure is incorrect.'})

    def __str__(self):
        return self.name


class ExtraUserDetail(StandardizeSearchableFieldMixin, models.Model):
    uid = KpiUidField(uid_prefix='u')
    user = models.OneToOneField(settings.AUTH_USER_MODEL,
                                related_name='extra_details',
                                on_delete=models.CASCADE)
    data = models.JSONField(default=dict)
    private_data = models.JSONField(default=dict)
    date_removal_requested = models.DateTimeField(null=True)
    date_removed = models.DateTimeField(null=True)
    password_date_changed = models.DateTimeField(null=True, blank=True)
    validated_password = models.BooleanField(default=True)

    def __str__(self):
        return '{}\'s data: {}'.format(self.user.__str__(), repr(self.data))

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if not update_fields or (update_fields and 'data' in update_fields):
            self.standardize_json_field('data', 'organization', str)
            self.standardize_json_field('data', 'name', str)

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )
        
        # Sync validated_password field to KobocatUserProfile
        if not settings.TESTING:
            if not update_fields or (update_fields and 'data' in update_fields):
                KobocatUserProfile.set_password_details(
                    self.user.id, 
                    self.validated_password,
                )

def create_extra_user_details(sender, instance, created, **kwargs):
    if created:
        ExtraUserDetail.objects.get_or_create(user=instance)


post_save.connect(create_extra_user_details, sender=settings.AUTH_USER_MODEL)
