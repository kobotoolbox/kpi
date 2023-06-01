from django.db import models, transaction
from django.db.models import Q
from django.db.models.constraints import UniqueConstraint

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatFormDisclaimer,
)


class FormDisclaimer(models.Model):

    language = models.ForeignKey(
        'languages.language',
        related_name='languages',
        on_delete=models.CASCADE,
    )
    asset = models.ForeignKey(
        'kpi.asset',
        related_name='disclaimers',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    message = models.TextField(default='')
    default = models.BooleanField(default=False)

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
        ]

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):

        with transaction.atomic():
            super().save(force_insert, force_update, using, update_fields)
            KobocatFormDisclaimer.sync(self)

    def delete(self, using=None, keep_parents=False):
        pk = self.pk
        with transaction.atomic():
            value = super().delete(using, keep_parents)
            KobocatFormDisclaimer.objects.filter(pk=pk).delete()
        return value


class OverriddenFormDisclaimer(FormDisclaimer):

    class Meta:
        verbose_name = 'per asset'
        verbose_name_plural = 'per asset'
        proxy = True
