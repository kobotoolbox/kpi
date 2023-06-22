import constance
import json

from django import template
from django.utils.translation import gettext_lazy as t

from kobo.apps.accounts.constants import NON_CONFIGURABLE_USER_REGISTRATION_FIELDS

register = template.Library()


@register.simple_tag(takes_context=True)
def custom_labels_language(context, field_name: str):
    """
    Returns a localized version of the labels provided in Constance
    """
    language = context['LANGUAGE_CODE']
    fields = json.loads(constance.config.USER_METADATA_FIELDS)
    for field in fields:
        if field['name'] == field_name:
            labels = field.get('label')
            label_keys = labels.keys()
            if language in label_keys:
                return labels.get(language)
            else:
                return labels.get('default')


@register.filter(name='is_configurable')
def is_configurable(value):
    """
    Checks to make sure the field is configurable
    """
    if value in NON_CONFIGURABLE_USER_REGISTRATION_FIELDS:
        return False
    else:
        return True
    