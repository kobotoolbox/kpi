from functools import partial

from django.conf import settings
from django.db import models
from django.utils.safestring import mark_safe, SafeData
from django.core.exceptions import ImproperlyConfigured
from markitup import widgets

_rendered_field_name = lambda name: '_%s_rendered' % name

def _get_render_func(dotted_path, **kwargs):
    module, func = dotted_path.rsplit('.', 1)
    func = getattr(__import__(module, {}, {}, [func]), func)
    return partial(func, **kwargs)

try:
    render_func = _get_render_func(settings.MARKITUP_FILTER[0],
                                   **settings.MARKITUP_FILTER[1])
except ImportError as e:
    raise ImproperlyConfigured("Could not import MARKITUP_FILTER %s: %s" %
                               (settings.MARKITUP_FILTER, e))
except AttributeError as e:
    raise ImproperlyConfigured("MARKITUP_FILTER setting is required")

class Markup(SafeData):
    def __init__(self, instance, field_name, rendered_field_name):
        # instead of storing actual values store a reference to the instance
        # along with field names, this makes assignment possible
        self.instance = instance
        self.field_name = field_name
        self.rendered_field_name = rendered_field_name

    # raw is read/write
    def _get_raw(self):
        return self.instance.__dict__[self.field_name]
    def _set_raw(self, val):
        setattr(self.instance, self.field_name, val)
    raw = property(_get_raw, _set_raw)

    # rendered is a read only property
    def _get_rendered(self):
        return getattr(self.instance, self.rendered_field_name)
    rendered = property(_get_rendered)

    # allows display via templates to work without safe filter
    def __str__(self):
        return mark_safe(self.rendered)

    # Return length of rendered string so that bool tests work as expected
    def __len__(self):
        return len(self.rendered)

    def render_with(self, dotted_path, **kwargs):
        render_func = _get_render_func(dotted_path, **kwargs)
        rendered = render_func(self.raw)
        setattr(self.instance, self.rendered_field_name, rendered)


class MarkupDescriptor(object):
    def __init__(self, field):
        self.field = field
        self.rendered_field_name = _rendered_field_name(self.field.name)

    def __get__(self, instance, owner):
        if instance is None:
            raise AttributeError('Can only be accessed via an instance.')
        markup = instance.__dict__[self.field.name]
        if markup is None:
            return None
        return Markup(instance, self.field.name, self.rendered_field_name)

    def __set__(self, obj, value):
        if isinstance(value, Markup):
            obj.__dict__[self.field.name] = value.raw
            setattr(obj, self.rendered_field_name, value.rendered)
        else:
            obj.__dict__[self.field.name] = value

class MarkupField(models.TextField):
    def __init__(self, *args, **kwargs):
        self.add_rendered_field = not kwargs.pop('no_rendered_field', False)
        super(MarkupField, self).__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name):
        if self.add_rendered_field and not cls._meta.abstract:
            rendered_field = models.TextField(editable=False, blank=True)
            cls.add_to_class(_rendered_field_name(name), rendered_field)
        super(MarkupField, self).contribute_to_class(cls, name)
        setattr(cls, self.name, MarkupDescriptor(self))

    def pre_save(self, model_instance, add):
        value = super(MarkupField, self).pre_save(model_instance, add)
        rendered = render_func(value.raw)
        setattr(model_instance, _rendered_field_name(self.attname), rendered)
        return value.raw

    def value_to_string(self, obj):
        value = self.value_from_object(obj)
        return value.raw

    def to_python(self, value):
        if isinstance(value, Markup):
            return value
        else:
            return super(MarkupField, self).to_python(value)

    def deconstruct(self):
        name, path, args, kwargs = super(MarkupField, self).deconstruct()
        # Force add_rendered_field to False for migrations
        # deconstruct can be called multiple times during the migration,
        # so setting it to self.add_rendered_field may do the wrong thing.
        kwargs['no_rendered_field'] = True
        return name, path, args, kwargs

    # this method should be renamed to get_prep_value but
    # for django 1.1 compatibility only signature is updated
    def get_db_prep_value(self, value, connection=None, prepared=False):
        try:
            return value.raw
        except AttributeError:
            return value

    def formfield(self, **kwargs):
        defaults = {'widget': widgets.MarkupTextarea}
        defaults.update(kwargs)
        field = super(MarkupField, self).formfield(**defaults)
        field.hidden_widget = widgets.MarkupHiddenWidget
        return field

# register MarkupField to use the custom widget in the Admin
from django.contrib.admin.options import FORMFIELD_FOR_DBFIELD_DEFAULTS
FORMFIELD_FOR_DBFIELD_DEFAULTS[MarkupField] = {'widget': widgets.AdminMarkItUpWidget}
