from allauth.socialaccount.models import SocialApp
from django import template
from django.db.models import Q

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
        appname = provider.app.name
        if appname:
            return appname
        return SocialApp.objects.get_current(provider, request).name
    except SocialApp.DoesNotExist:
        return provider.name


@register.simple_tag()
def get_social_apps():
    return SocialApp.objects.filter(Q(custom_data__is_public=True) | Q(custom_data__isnull=True))
