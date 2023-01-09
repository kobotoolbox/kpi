from django import template
from django.conf import settings

register = template.Library()

@register.simple_tag
def accounts_settings():
    account_settings = settings.KOBOFORM_URL + '/#/account/settings'
    return account_settings