# coding: utf-8
import constance
from django.conf import settings

from hub.models import ConfigurationFile, PerUserSetting
from hub.utils.i18n import I18nUtils


def external_service_tokens(request):
    out = {}
    if settings.GOOGLE_ANALYTICS_TOKEN:
        out['google_analytics_token'] = settings.GOOGLE_ANALYTICS_TOKEN
    if settings.RAVEN_JS_DSN:
        out['raven_js_dsn'] = settings.RAVEN_JS_DSN
    try:
        intercom_setting = PerUserSetting.objects.get(name='INTERCOM_APP_ID')
    except PerUserSetting.DoesNotExist:
        pass
    else:
        out['intercom_app_id'] = intercom_setting.get_for_user(request.user)
    return out


def email(request):
    out = {}
    # 'kpi_protocol' used in the activation_email.txt template
    out['kpi_protocol'] = request.META.get('wsgi.url_scheme', 'http')
    return out


def sitewide_messages(request):
    """
    required in the context for any pages that need to display
    custom text in django templates
    """
    if request.path_info.endswith("accounts/register/"):

        sitewide_message = I18nUtils.get_sitewide_message()
        if sitewide_message is not None:
            return {"welcome_message": sitewide_message}

    return {}


class CombinedConfig:
    '''
    An object that gets its attributes from both a dictionary (`extra_config`)
    AND a django-constance LazyConfig object
    '''
    def __init__(self, constance_config, extra_config):
        '''
        constance_config: LazyConfig object
        extra_config: dictionary
        '''
        self.constance_config = constance_config
        self.extra_config = extra_config

    def __getattr__(self, key):
        try:
            return self.extra_config[key]
        except KeyError:
            return getattr(self.constance_config, key)


def config(request):
    '''
    Merges django-constance configuration field names and values with
    slugs and URLs for each hub.ConfigurationFile. Example use in a template:

        Please visit our <a href="{{ config.SUPPORT_URL }}">help page</a>.
        <img src="{{ config.logo }}">

    '''
    conf_files = {f.slug: f.url for f in ConfigurationFile.objects.all()}
    return {'config': CombinedConfig(constance.config, conf_files)}
