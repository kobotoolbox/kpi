from django.conf import settings
from django.db import models, transaction
from django.db.models import Q
from django.db.models.constraints import UniqueConstraint
from markdownx.models import MarkdownxField

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatFormDisclaimer,
)
from kobo.apps.markdownx_uploader.models import AbstractMarkdownxModel


class FormDisclaimer(AbstractMarkdownxModel):

    markdown_fields = ['message']

    language = models.ForeignKey(
        'languages.language',
        related_name='languages',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    asset = models.ForeignKey(
        'kpi.asset',
        related_name='disclaimers',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    message = MarkdownxField()
    default = models.BooleanField(default=False)
    hidden = models.BooleanField(
        'Hide default disclaimer for all languages of the form', default=False
    )

    def __str__(self):
        if getattr(self, 'asset'):
            return f'Disclaimer for asset {self.asset.uid}'
        else:
            return (
                f'Global disclaimer for {self.language.name} '
                f'({self.language.code})'
            )

    class Meta:
        verbose_name = 'global'
        verbose_name_plural = 'global'
        constraints = [
            UniqueConstraint(
                fields=['language', 'asset'],
                name='uniq_disclaimer_with_asset',
            ),
            UniqueConstraint(
                fields=['language'],
                condition=Q(asset=None),
                name='uniq_disclaimer_without_asset',
            ),
            UniqueConstraint(
                fields=['asset', 'hidden'],
                condition=Q(hidden=True),
                name='uniq_hidden_disclaimer_per_asset',
            ),
        ]

    def save(self, *args, **kwargs):

        with transaction.atomic():
            super().save(*args, **kwargs)
            if not settings.TESTING:
                KobocatFormDisclaimer.sync(self)

    def delete(self, using=None, keep_parents=False):
        pk = self.pk
        with transaction.atomic():
            value = super().delete(using, keep_parents)
            if not settings.TESTING:
                KobocatFormDisclaimer.objects.filter(pk=pk).delete()
        return value


class OverriddenFormDisclaimer(FormDisclaimer):

    class Meta:
        verbose_name = 'per asset'
        verbose_name_plural = 'per asset'
        proxy = True
