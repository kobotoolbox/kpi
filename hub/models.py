from django.db import models
from django.db.models.signals import post_save
from django.conf import settings
from markitup.fields import MarkupField
from jsonfield import JSONField

from kpi.deployment_backends.kc_reader.utils import get_kc_profile_data
from kpi.deployment_backends.kc_reader.utils import set_kc_require_auth


class SitewideMessage(models.Model):
    slug = models.CharField(max_length=50)
    body = MarkupField()
    def __str__(self):
        return self.slug


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

    # @jnm: Can we reassess how to do this and not break tests?
    '''
    def __init__(self, *args, **kwargs):
        result = super(ExtraUserDetail, self).__init__(*args, **kwargs)
        # Copy data from the user's KC profile, if applicable, one time only.
        # Do not overwrite any existing data in this object
        if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL:
            if self.user_id is not None and not self.data.get(
                    'copied_kc_profile', False):
                kc_detail = get_kc_profile_data(self.user_id)
                for k, v in kc_detail.iteritems():
                    if self.data.get(k, None) is None:
                        self.data[k] = v
                        self.data['copied_kc_profile'] = True
        return result
    '''

    def save(self, *args, **kwargs):
        # `require_auth` needs to be written back to KC
        if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL:
            if self.user_id is not None and 'require_auth' in self.data:
                set_kc_require_auth(self.user_id, self.data['require_auth'])
        return super(ExtraUserDetail, self).save(*args, **kwargs)

    def __unicode__(self):
        return '{}\'s data: {}'.format(self.user.__unicode__(), repr(self.data))


def create_extra_user_details(sender, instance, created, **kwargs):
    if created:
        ExtraUserDetail.objects.get_or_create(user=instance)

post_save.connect(create_extra_user_details, sender=settings.AUTH_USER_MODEL)
