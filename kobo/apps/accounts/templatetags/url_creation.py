from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def account_security():
    # Not using `reverse()` because this is a route within the SPA
    account_security = settings.KOBOFORM_URL + '/#/account/security'
    return account_security
