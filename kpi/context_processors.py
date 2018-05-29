import constance
from django.conf import settings
from django.db.models import Q
from django.db.models.functions import Length
from django.utils.translation import get_language
from hub.models import SitewideMessage, ConfigurationFile


def external_service_tokens(request):
    out = {}
    if settings.GOOGLE_ANALYTICS_TOKEN:
        out['google_analytics_token'] = settings.GOOGLE_ANALYTICS_TOKEN
    if settings.INTERCOM_APP_ID:
        out['intercom_app_id'] = settings.INTERCOM_APP_ID
    if settings.RAVEN_JS_DSN:
        out['raven_js_dsn'] = settings.RAVEN_JS_DSN
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
        # Let's retrieve messages where slug is either:
        #  - "welcome_message_<locale>"
        #  - "welcome_message"
        # We order the result by the length of the slug to be sure
        # localized version comes first.
        sitewide_message = SitewideMessage.objects\
            .filter(
                Q(slug="welcome_message_{}".format(get_language())) |
                Q(slug="welcome_message"))\
            .order_by(Length("slug").desc())\
            .first()

        if sitewide_message is not None:
            return {"welcome_message": sitewide_message.body}

    return {}


class CombinedConfig(object):
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
