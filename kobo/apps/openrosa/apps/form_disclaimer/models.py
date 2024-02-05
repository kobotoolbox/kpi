from django.db import models
from django.db.models import Q
from django.db.models.constraints import UniqueConstraint


class FormDisclaimer(models.Model):

    language_code = models.CharField(max_length=5, null=True, db_index=True)
    xform = models.ForeignKey(
        'logger.xform',
        related_name='disclaimers',
        null=True,
        on_delete=models.CASCADE,
    )
    message = models.TextField(default='')
    default = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)

    class Meta:
        # FIXME duplicate app with KPI
        app_label = 'openrosa_form_disclaimer'
        db_table = 'openrosa_form_disclaimer_formdisclaimer'
        constraints = [
            UniqueConstraint(
                fields=['language_code', 'xform'],
                name='uniq_disclaimer_with_xform',
            ),
            UniqueConstraint(
                fields=['language_code'],
                condition=Q(xform=None),
                name='uniq_disclaimer_without_xform',
            ),
            UniqueConstraint(
                fields=['xform', 'hidden'],
                condition=Q(hidden=True),
                name='uniq_hidden_disclaimer_per_xform',
            ),
        ]
