from django.http import HttpResponseRedirect
from django.conf import settings
from models import FormBuilderPreference

class OtherFormBuilderRedirectMiddleware(object):
    '''
    If the user prefers to use another form builder, redirect to it
    '''
    THIS_BUILDER = FormBuilderPreference.KPI
    PREFERENCE_TO_URL = {
        FormBuilderPreference.KPI: settings.KPI_URL,
        FormBuilderPreference.DKOBO: settings.DKOBO_URL,
    }

    def _redirect_if_necessary(self, request, preferred_builder):
        try:
            preferred_url = self.PREFERENCE_TO_URL[preferred_builder]
        except KeyError:
            # Ignore invalid preference
            return
        if not request.build_absolute_uri().startswith(preferred_url):
            return HttpResponseRedirect(preferred_url)

    def process_view(self, request, view_func, view_args, view_kwargs):
        ''' Using process_view instead of process_request allows the resolver
        to run and return 404 when appropriate, instead of blindly returning
        302 for all requests '''
        preferred_builder = self.THIS_BUILDER
        if not settings.KPI_URL or not settings.DKOBO_URL \
                or request.user.is_anonymous():
            # Do not attempt to redirect if the necessary URLs are not
            # configured or the user is anonymous
            return
        try:
            preferred_builder = \
                request.user.formbuilderpreference.preferred_builder
        except FormBuilderPreference.DoesNotExist:
            # Ignore missing preference
            pass    
        return self._redirect_if_necessary(request, preferred_builder)
