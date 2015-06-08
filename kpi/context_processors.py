from django.conf import settings

def dev_mode(request):
    out = {}
    out['livereload_script']  = settings.LIVERELOAD_SCRIPT
    return out