from django.db import models
from django.db.models.signals import post_save
from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from markitup.fields import MarkupField
from jsonfield import JSONField


class SitewideMessage(models.Model):
    slug = models.CharField(max_length=50)
    body = MarkupField()
    def __str__(self):
        return self.slug


class ConfigurationFile(models.Model):
    LOGO = 'logo'
    LOGO_SMALL = 'logo_small'
    LOGIN_BACKGROUND = 'login_background'

    SLUG_CHOICES = (
        (LOGO, LOGO),
        (LOGO_SMALL, LOGO_SMALL),
        (LOGIN_BACKGROUND, LOGIN_BACKGROUND),
    )

    slug = models.CharField(max_length=32, choices=SLUG_CHOICES, unique=True)
    content = models.FileField()

    def __str__(self):
        return self.slug

    @classmethod
    def redirect_view(cls, request, slug):
        '''
        When using storage with URLs that expire (e.g. Amazon S3), this view
        allows for persistent URLs--which then redirect to the temporary URLs
        '''
        obj = get_object_or_404(cls, slug=slug)
        return HttpResponseRedirect(obj.content.url)

    @property
    def url(self):
        return reverse('configurationfile', kwargs={'slug': self.slug})


class FormBuilderPreference(models.Model):
    KPI = 'K'
    DKOBO = 'D'
    BUILDER_CHOICES = (
        (KPI, 'kpi'),
        (DKOBO, 'dkobo')
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL)
    preferred_builder = models.CharField(
        max_length=1,
        choices=BUILDER_CHOICES,
        default=KPI,
    )
    def __unicode__(self):
        choices_dict = dict(self.BUILDER_CHOICES)
        choice_label = choices_dict[self.preferred_builder]
        return u'{} prefers {}'.format(self.user, choice_label)


class ExtraUserDetail(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name='extra_details')
    data = JSONField(default={})

    def __unicode__(self):
        return '{}\'s data: {}'.format(self.user.__unicode__(), repr(self.data))


def create_extra_user_details(sender, instance, created, **kwargs):
    if created:
        ExtraUserDetail.objects.get_or_create(user=instance)

post_save.connect(create_extra_user_details, sender=settings.AUTH_USER_MODEL)
