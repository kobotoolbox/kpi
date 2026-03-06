from django.conf import settings
from django.db import models

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel


class IdentityProvider(AbstractTimeStampedModel, models.Model):
    id = KpiUidField(uid_prefix='idp', primary_key=True)
    name = models.CharField(
        max_length=255, verbose_name='Name', help_text='Display name for the IdP'
    )
    slug = models.SlugField(
        unique=True,
        verbose_name='Slug',
        help_text='Unique identifier used in URLs (e.g., /api/scim/v2/{slug}/Users)',
    )
    # The token used to authenticate SCIM requests from the IdP
    scim_api_key = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='SCIM API Key',
        help_text='The API key used for SCIM authentication',
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Is active',
        help_text='Whether this IdP is active for deprovisioning and SSO',
    )
    social_app = models.ForeignKey(
        'socialaccount.SocialApp',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scim_idps',
        help_text='The associated SSO Social Application',
    )

    class Meta:
        verbose_name = 'Identity Provider'
        verbose_name_plural = 'Identity Providers'

    def __str__(self):
        return f'{self.name} ({self.slug})'


class ScimGroup(AbstractTimeStampedModel, models.Model):
    id = KpiUidField(uid_prefix='scg', primary_key=True)
    idp = models.ForeignKey(
        IdentityProvider,
        on_delete=models.CASCADE,
        related_name='scim_groups',
        help_text='The Identity Provider this group belongs to',
    )
    name = models.CharField(
        max_length=255, verbose_name='Name', help_text='Display name for the SCIM group'
    )
    scim_external_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='SCIM External ID',
        help_text='The external ID provided by the Identity Provider',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='scim_groups',
        help_text='Users belonging to this SCIM group',
    )

    class Meta:
        verbose_name = 'SCIM Group'
        verbose_name_plural = 'SCIM Groups'
        unique_together = ('idp', 'name')

    def __str__(self):
        return f'{self.name} [{self.idp.name}]'
