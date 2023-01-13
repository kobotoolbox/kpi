from django import template
from django.conf import settings
from allauth.socialaccount.models import SocialApp

register = template.Library()


@register.simple_tag(takes_context=True)
def get_provider_appname(context, provider=None):
    """
    Get the SocialApplication.name (customizable in the Django-Admin interface)
    for a given SocialAccount provider.

    Returns provider.name if there is no app matching the provider.

    Usage:

    {% get_provider_appname provider as appname %}
    {{ appname }}

      or, if provider is in scope already,

    {% get_provider_appname as appname %}
    {{ appname }}
    """
    provider = provider or context['provider']
    request = context['request']
    try:
        appname = provider.get_app(request).name
        return appname
    except SocialApp.DoesNotExist:
        return provider.name


@register.simple_tag()
def get_social_apps():
    if settings.SOCIALACCOUNT_PROVIDERS:
        return SocialApp.objects.all()
    return []
