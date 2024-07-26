# coding: utf-8
import constance
import markdown
from django.conf import settings
from django.urls import reverse

from kpi.utils.markdown import markdownify
from hub.models import ConfigurationFile
from hub.utils.i18n import I18nUtils


def custom_password_guidance_text(request):
    if constance.config.ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT:
        help_text = I18nUtils.get_custom_password_help_text()
        return {'custom_guidance_text': help_text}
    return {}


def external_service_tokens(request):
    out = {}
    if settings.GOOGLE_ANALYTICS_TOKEN:
        out['google_analytics_token'] = settings.GOOGLE_ANALYTICS_TOKEN
    if settings.SENTRY_JS_DSN:
        out['sentry_js_dsn'] = settings.SENTRY_JS_DSN
    return out


def email(request):
    out = {}
    # 'kpi_protocol' used in the activation_email.txt template
    out['kpi_protocol'] = request.META.get('wsgi.url_scheme', 'http')
    return out


def kobocat(request):
    return {
        'koboform_url': settings.KOBOFORM_URL,
    }

def mfa(request):
    def get_mfa_help_text():
        return markdown.markdown(I18nUtils.get_mfa_help_text())

    def get_mfa_enabled():
        return ('true' if constance.config.MFA_ENABLED else 'false',)

    return {
        # Use (the strings) 'true' or 'false' to generate a true boolean if
        # used in Javascript
        'mfa_enabled': get_mfa_enabled,
        # Allow markdown to emphasize part of the text and/or activate hyperlink
        'mfa_help_text': get_mfa_help_text,
    }


def django_settings(request):
    return {'stripe_enabled': settings.STRIPE_ENABLED}


def sitewide_messages(request):
    """
    required in the context for any pages that need to display
    custom text in django templates
    """
    if request.path_info == reverse('account_signup'):
        sitewide_message = I18nUtils.get_sitewide_message()
        if sitewide_message is not None:
            return {'welcome_message': markdownify(sitewide_message)}

    return {}


class CombinedConfig:
    """
    An object that gets its attributes from both a dictionary (`extra_config`)
    AND a django-constance LazyConfig object
    """

    def __init__(self, constance_config, extra_config):
        """
        constance_config: LazyConfig object
        extra_config: dictionary
        """
        self.constance_config = constance_config
        self.extra_config = extra_config

    def __getattr__(self, key):
        try:
            return self.extra_config[key]
        except KeyError:
            return getattr(self.constance_config, key)


def config(request):
    """
    Merges django-constance configuration field names and values with
    slugs and URLs for each hub.ConfigurationFile. Example use in a template:

        Please visit our <a href="{{ config.SUPPORT_URL }}">help page</a>.
        <img src="{{ config.logo }}">

    """
    conf_files = {f.slug: f.url for f in ConfigurationFile.objects.all()}
    return {'config': CombinedConfig(constance.config, conf_files)}
