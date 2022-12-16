from django import template

register = template.Library()

@register.simple_tag(takes_context=True)
def get_provider_appname(context, provider=None):
  """
  Get the SocialApplication.name (customizable in the Django-Admin interface)
  for a given SocialAccount provider.

  Usage:

  {% get_provider_appname provider as appname %}
  {{ appname }}

    or, if provider is in scope already,

  {% get_provider_appname as appname %}
  {{ appname }}
  """
  provider = provider or context['provider']
  request = context['request']
  appname = provider.get_app(request).name
  return appname
