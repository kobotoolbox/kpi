from django.conf import settings
from hub.models import SitewideMessage

def dev_mode(request):
    out = {}
    out['livereload_script']  = settings.LIVERELOAD_SCRIPT
    out['use_minified_script'] = settings.USE_MINIFIED_SCRIPTS
    if settings.TRACKJS_TOKEN:
        out['trackjs_token'] = settings.TRACKJS_TOKEN
    return out


def git_commit(request):
    return {
        'git_commit': settings.CACHEBUSTER_UNIQUE_STRING,
    }


def sitewide_messages(request):
    '''
    required in the context for any pages that need to display
    custom text in django templates
    '''
    if request.path_info.endswith("accounts/register/"):
        try:
            return {
                'welcome_message': SitewideMessage.objects.get(
                    slug='welcome_message').body
            }
        except SitewideMessage.DoesNotExist as e:
            return {}
    return {}
