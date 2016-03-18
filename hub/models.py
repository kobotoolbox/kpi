from django.db import models
from django.conf import settings
from markitup.fields import MarkupField
from jsonfield import JSONField
import jmespath

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


class UserRegistrationChoiceManager(models.Manager):
    def get_choices_for_field(self, field_name):
        return self.get_or_create(field_name=field_name)[0].choices


class UserRegistrationChoice(models.Model):
    field_name = models.CharField(max_length=50, unique=True)
    json_data = JSONField()
    value_label_path = models.CharField(
        max_length=100, help_text='Must yield an array of arrays in the '
            'format `[[value, label], [value, label], ...]`. See '
            'http://jmespath.org/')
    objects = UserRegistrationChoiceManager()

    @property
    def choices(self):
        choices = [['', '']]
        # TODO: Cache this if `json_data` is going to be huge?
        choices += jmespath.search(self.value_label_path, self.json_data)
        return choices

    def __unicode__(self):
        choices = self.choices
        count = len(choices) if choices else 0
        return '{}: {} choices'.format(self.field_name, count)


class ExtraUserDetail(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL)
    data = JSONField()
    def __unicode__(self):
        return self.user.__unicode__()
