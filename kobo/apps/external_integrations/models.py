# coding: utf-8
from django.db import models
from django.utils.translation import ugettext_lazy as _


def _set_cors_field_options(name, bases, attrs):
    cls = type(name, bases, attrs)
    # The `cors` field is already defined by `AbstractCorsModel`, but let's
    # help folks out by giving it a more descriptive name and help text, which
    # will both appear in the admin interface
    cors_field = cls._meta.get_field('cors')
    cors_field.verbose_name = _('allowed origin')
    cors_field.help_text = _('You must include scheme (http:// or https://)')
    return cls


class CorsModel(models.Model, metaclass=_set_cors_field_options):
    """
    A model with one field, `cors`, which specifies an allowed origin that must
    exactly match the host with its scheme. e.g. https://example.com
    """

    cors = models.CharField(max_length=255)

    def __str__(self):
        return self.cors

    class Meta:
        verbose_name = _('allowed CORS origin')
