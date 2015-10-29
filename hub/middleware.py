from django.http import HttpResponseRedirect
from django.conf import settings
from models import FormBuilderPreference

class OtherFormBuilderRedirectMiddleware(object):
    '''
    If the user prefers to use another form builder, redirect to it
    '''
    THIS_BUILDER = FormBuilderPreference.KPI
    PREFERENCE_TO_PREFIX = {
        FormBuilderPreference.KPI: settings.KPI_PREFIX,
        FormBuilderPreference.DKOBO: settings.DKOBO_PREFIX,
    }

    def _redirect_if_necessary(self, request, preferred_builder):
        try:
            preferred_prefix = self.PREFERENCE_TO_PREFIX[preferred_builder]
        except KeyError:
            # Ignore invalid preference
            return
        prefix_length = max(1, len(request.path) - len(request.path_info))
        prefix = request.path[:prefix_length]
        if prefix != preferred_prefix:
            try:
                # Requires Django 1.7
                scheme = request.scheme
            except:
                scheme = 'https' if request.is_secure() else 'http'
            return HttpResponseRedirect(u'{}://{}{}'.format(
                scheme, request.get_host(), preferred_prefix))

    def process_view(self, request, view_func, view_args, view_kwargs):
        ''' Using process_view instead of process_request allows the resolver
        to run and return 404 when appropriate, instead of blindly returning
        302 for all requests '''
        preferred_builder = self.THIS_BUILDER
        if not settings.KPI_PREFIX or not settings.DKOBO_PREFIX \
                or request.user.is_anonymous():
            # Do not attempt to redirect if the necessary prefixes are not
            # configured or the user is anonymous
            return
        try:
            preferred_builder = \
                request.user.formbuilderpreference.preferred_builder
        except FormBuilderPreference.DoesNotExist:
            # Ignore missing preference
            pass
        return self._redirect_if_necessary(request, preferred_builder)
