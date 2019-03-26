from django.utils.translation import ugettext_lazy as _
from corsheaders.models import AbstractCorsModel


def _set_cors_field_options(name, bases, attrs):
    cls = type(name, bases, attrs)
    # The `cors` field is already defined by `AbstractCorsModel`, but let's
    # help folks out by giving it a more descriptive name and help text, which
    # will both appear in the admin interface
    cors_field = cls._meta.get_field('cors')
    cors_field.verbose_name = _('allowed origin')
    cors_field.help_text = _('do not include http:// or https://')
    return cls


class CorsModel(AbstractCorsModel):
    '''
    A model with one field, `cors`, which specifies an allowed origin that must
    exactly match the `netloc` returned by `urlparse`
    '''

    def __unicode__(self):
        return self.cors

    __metaclass__ = _set_cors_field_options

    class Meta:
        verbose_name = _('allowed CORS origin')
