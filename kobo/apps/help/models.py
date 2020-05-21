# coding: utf-8
# 😇
import datetime

from django.contrib.postgres.fields import JSONField as JSONBField
from django.conf import settings
from django.db import models
from django.utils.module_loading import import_string
from markdownx.models import MarkdownxField
from markdownx.settings import MARKDOWNX_MARKDOWNIFY_FUNCTION
from private_storage.fields import PrivateFileField

from kpi.fields import KpiUidField

EPOCH_BEGINNING = datetime.datetime.utcfromtimestamp(0)
markdownify = import_string(MARKDOWNX_MARKDOWNIFY_FUNCTION)


class InAppMessage(models.Model):
    """
    A message, composed in the Django admin interface, displayed to regular
    users within the application
    """
    uid = KpiUidField(uid_prefix="iam")
    title = models.CharField(max_length=255)
    snippet = MarkdownxField()
    body = MarkdownxField()
    # Could change to `django.contrib.auth.get_user_model()` in Django 1.11+
    published = models.BooleanField(
        default=False,
        help_text='When published, this message appears to all users. '
                  'It otherwise appears only to the last editor'
    )
    # Make the author deliberately set these dates to something valid
    valid_from = models.DateTimeField(default=EPOCH_BEGINNING)
    valid_until = models.DateTimeField(default=EPOCH_BEGINNING)
    last_editor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return '{} ({})'.format(self.title, self.uid)

    @property
    def html(self):
        # TODO: Djangerz template processing...
        # Make `request.user.extra_detail` available in the context as `user`
        MARKDOWN_FIELDS_TO_CONVERT = ('snippet', 'body')
        result = {}
        for field in MARKDOWN_FIELDS_TO_CONVERT:
            result[field] = markdownify(getattr(self, field))
        return result


class InAppMessageFile(models.Model):
    """
    A file uploaded by the django-markdownx editor. It doesn't have a foreign
    key to `InAppMessage` because it was likely uploaded while the message was
    still being drafted, before ever being saved in the database
    """
    # TODO: Clean these up if they're no longer referenced by an
    # `InAppMessage`? Parse the Markdown to figure it out? GitHub does it
    # somehow…
    content = PrivateFileField(
        # Avoid collisions with usernames, which must begin with `[a-z]`
        # (see `kpi.forms.USERNAME_REGEX`)
        upload_to='__in_app_message/%Y/%m/%d/'
    )

    def __str__(self):
        return self.content.name


class InAppMessageUserInteractions(models.Model):
    message = models.ForeignKey(InAppMessage, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    interactions = JSONBField(default=dict)

    class Meta:
        unique_together = ('message', 'user')

    def __str__(self):
        return '{} with {} ({}): {}'.format(
            self.user.username,
            self.message.title,
            self.message.uid,
            self.interactions,
        )
