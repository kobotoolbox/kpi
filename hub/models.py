from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import FieldError, ValidationError
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models.signals import post_save
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext_lazy as _
from jsonbfield.fields import JSONField as JSONBField
from jsonfield import JSONField
from markitup.fields import MarkupField

from kpi.models.object_permission import get_anonymous_user


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


class PerUserSetting(models.Model):
    """
    A configuration setting that has different values depending on whether not
    a user matches certain criteria
    """
    user_queries = JSONBField(
        help_text=_('A JSON representation of a *list* of Django queries, '
                    'e.g. `[{"email__iendswith": "@kobotoolbox.org"}, '
                    '{"email__iendswith": "@kbtdev.org"}]`. '
                    'A matching user is one who would be returned by ANY of '
                    'the queries in the list.')
    )
    name = models.CharField(max_length=255, unique=True,
                            default='INTERCOM_APP_ID') # The only one for now!
    value_when_matched = models.CharField(max_length=2048, blank=True)
    value_when_not_matched = models.CharField(max_length=2048, blank=True)

    def user_matches(self, user, ignore_invalid_queries=True):
        if user.is_anonymous():
            user = get_anonymous_user()
        manager = user._meta.model.objects
        queryset = manager.none()
        for user_query in self.user_queries:
            try:
                queryset |= manager.filter(**user_query)
            except (FieldError, TypeError):
                if ignore_invalid_queries:
                    return False
                else:
                    raise
        return queryset.filter(pk=user.pk).exists()

    def get_for_user(self, user):
        if self.user_matches(user):
            return self.value_when_matched
        else:
            return self.value_when_not_matched

    def clean(self):
        user = User.objects.first()
        if not user:
            return
        try:
            self.user_matches(user, ignore_invalid_queries=False)
        except FieldError as e:
            raise ValidationError({'user_queries': e.message})
        except TypeError:
            raise ValidationError(
                {'user_queries': _('JSON structure is incorrect.')})

    def __str__(self):
        return self.name

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
