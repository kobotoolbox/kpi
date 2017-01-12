from django.http import HttpResponseRedirect
from django.conf import settings
from models import FormBuilderPreference
from hub.views import switch_builder

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
        preferred_builder_key = preferred_builder.preferred_builder
        preferred_prefix = self.PREFERENCE_TO_PREFIX[preferred_builder_key]
        prefix_length = max(1, len(request.path) - len(request.path_info))
        prefix = request.path[:prefix_length]
        if prefix.strip('/') != preferred_prefix.strip('/'):
            try:
                # Requires Django 1.7
                scheme = request.scheme
            except Exception:
                scheme = 'https' if request.is_secure() else 'http'
            return HttpResponseRedirect(u'{}://{}{}'.format(
                scheme, request.get_host(), preferred_prefix))

    def process_view(self, request, view_func, view_args, view_kwargs):
        ''' Using process_view instead of process_request allows the resolver
        to run and return 404 when appropriate, instead of blindly returning
        302 for all requests '''
        if view_func is switch_builder:
            # Never redirect the view that changes form builder preference
            return
        if request.path_info.startswith('/admin/'):
            # Never redirect the admin interface
            return
        preferred_builder = self.THIS_BUILDER
        if not settings.KPI_PREFIX or not settings.DKOBO_PREFIX \
                or request.user.is_anonymous():
            # Do not attempt to redirect if the necessary prefixes are not
            # configured or the user is anonymous
            return
        (preferred_builder, created) = \
            FormBuilderPreference.objects.get_or_create(user=request.user)
        return self._redirect_if_necessary(request, preferred_builder)
