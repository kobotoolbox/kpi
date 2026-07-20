# coding: utf-8
from django.core.exceptions import ValidationError
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
            'Must contain exactly the URI scheme and host, e.g. '
            'https://example.com. Include a port only if it is non-standard, '
            'e.g. https://example.com:1234. Do not include the default port '
            'for the scheme (80 for http, 443 for https): browsers never send '
            'it in the `Origin` header, so it would never match.'
    )

    def clean(self):
        super().clean()
        for scheme, port in {'http:': '80', 'https:': '443'}:
            if self.cors.startswith(scheme) and self.cors.endswith(f':{port}'):
                raise ValidationError({
                    'cors': (
                        f'Do not include the default port ({port}) for '
                        f'{scheme[:-1]}. Browsers never send it in the '
                        f'`Origin` header, so this entry would never match.'
                    )
                })

    def __str__(self):
        return self.cors

    class Meta:
        verbose_name = 'allowed CORS origin'
