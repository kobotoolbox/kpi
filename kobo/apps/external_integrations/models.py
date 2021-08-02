# coding: utf-8
from django.db import models


class CorsModel(models.Model):
    """
    A model with one field, `cors`, which specifies an allowed origin that must
    exactly match `request.META.get('HTTP_ORIGIN')`
    """

    cors = models.CharField(
        max_length=255,
        verbose_name='allowed origin',
        help_text=
            'Must contain exactly the URI scheme, host, and port, e.g. '
            'https://example.com:1234. Standard ports (80 for http and 443 '
            'for https) may be omitted.'
    )

    def __str__(self):
        return self.cors

    class Meta:
        verbose_name = 'allowed CORS origin'
