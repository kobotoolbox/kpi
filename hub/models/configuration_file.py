import mimetypes

from django.conf import settings
from django.contrib.auth.password_validation import get_default_password_validators
from django.db import models
from django.http import FileResponse, HttpResponse, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.http import http_date

# `was_modified_since` is undocumented(?) but used by django-private-storage,
# whose approach is emulated here
from django.views.static import was_modified_since


def _configuration_file_upload_to(instance, filename):
    if instance.slug == ConfigurationFileSlug.COMMON_PASSWORDS_FILE:
        # Void lru cache to reload the file at the next password validation.
        get_default_password_validators.cache_clear()
        return f'__django_files/{instance.slug}/{filename}'

    return f'{settings.PUBLIC_MEDIA_PATH}/{instance.slug}/{filename}'


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
            'to access common passwords file.'
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
            request.META.get('HTTP_IF_MODIFIED_SINCE'), mtime
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
