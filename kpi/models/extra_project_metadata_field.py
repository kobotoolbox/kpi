from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _


class ExtraProjectMetadataField(models.Model):
    class FieldType(models.TextChoices):
        TEXT = 'text', _('Text')
        SINGLE_SELECT = 'single_select', _('Single Select')
        MULTI_SELECT = 'multi_select', _('Multi Select')

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text=_("Unique internal identifier (e.g. 'project_sectors')"),
    )
    label = models.JSONField(
        default=dict,
        blank=True,
        help_text=_("Translation map: {'default': 'Country', 'fr': 'Pays'}"),
    )
    type = models.CharField(
        max_length=20, choices=FieldType.choices, default=FieldType.TEXT
    )
    is_required = models.BooleanField(default=False, verbose_name=_('Required'))
    options = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of {'name': 'val', 'label': {...}} dicts"),
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Extra Project Metadata Field')
        verbose_name_plural = _('Extra Project Metadata Fields')

    def clean(self):
        super().clean()
        # Requirement: Options required for select types
        if self.type in [self.FieldType.SINGLE_SELECT, self.FieldType.MULTI_SELECT]:
            if not self.options:
                raise ValidationError(
                    {'options': _("Options are required for select fields.")}
                )

    def __str__(self):
        return self.name
