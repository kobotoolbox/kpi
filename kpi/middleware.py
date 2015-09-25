from django.http import HttpResponseRedirect
from django.conf import settings
from hub.models import FormBuilderPreference

class OtherFormBuilderRedirectMiddleware(object):
    '''
    If the user prefers to use another form builder, redirect to it
    '''
    def process_request(self, request):
        if request.user.is_anonymous():
            return
        if not settings.DKOBO_URL:
            return
        try:
            preferred_builder = \
                request.user.formbuilderpreference.preferred_builder
        except FormBuilderPreference.DoesNotExist:
            return
        if preferred_builder == FormBuilderPreference.DKOBO:
            return HttpResponseRedirect(settings.DKOBO_URL)
