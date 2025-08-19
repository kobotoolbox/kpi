# coding: utf-8
# 😇
import datetime

from django.conf import settings
from django.db import models
from markdownx.models import MarkdownxField

from kobo.apps.markdownx_uploader.models import (
    AbstractMarkdownxModel,
    MarkdownxUploaderFile,
    MarkdownxUploaderFileReference,
)
from kpi.fields import KpiUidField
from kpi.utils.markdown import markdownify


EPOCH_BEGINNING = datetime.datetime.utcfromtimestamp(0)


class InAppMessage(AbstractMarkdownxModel):
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
    always_display_as_new = models.BooleanField(
        default=False,
        help_text='When enabled, this message reappears each time the '
                  'application loads, even if it has already been '
                  'acknowledged.'
    )
    # Make the author deliberately set these dates to something valid
    valid_from = models.DateTimeField(default=EPOCH_BEGINNING)
    valid_until = models.DateTimeField(default=EPOCH_BEGINNING)
    last_editor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # We do not want to use a generic foreign key or tightly couple this model
    # with another one, so we use JSONField to store related object name and pk
    generic_related_objects = models.JSONField(default=dict)

    markdown_fields = ['snippet', 'body']

    def __str__(self):
        return '{} ({})'.format(self.title, self.uid)

    @property
    def html(self):
        # TODO: Djangerz template processing...
        # Make `request.user.extra_detail` available in the context as `user`
        result = {}
        for field in self.markdown_fields:
            result[field] = markdownify(getattr(self, field))
        return result


class InAppMessageUsers(models.Model):

    in_app_message = models.ForeignKey(InAppMessage, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)


class InAppMessageFile(MarkdownxUploaderFile):
    class Meta:
        proxy = True


class InAppMessageUserInteractions(models.Model):
    message = models.ForeignKey(InAppMessage, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    interactions = models.JSONField(default=dict)

    class Meta:
        unique_together = ('message', 'user')

    def __str__(self):
        return '{} with {} ({}): {}'.format(
            self.user.username,
            self.message.title,
            self.message.uid,
            self.interactions,
        )
