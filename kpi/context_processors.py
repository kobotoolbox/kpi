from django.conf import settings

def dev_mode(request):
    out = {}
    out['livereload_script']  = settings.LIVERELOAD_SCRIPT
    out['use_minified_script'] = settings.USE_MINIFIED_SCRIPTS
    if settings.TRACKJS_TOKEN:
        out['trackjs_token'] = settings.TRACKJS_TOKEN
    return out
