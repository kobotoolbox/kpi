from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils.deprecation import MiddlewareMixin

from kobo.apps.openrosa import koboform


class ConditionalRedirects(MiddlewareMixin):

    def process_view(self, request, view, view_args, view_kwargs):

        is_legacy_domain = (
            request.build_absolute_uri('/') == f'{settings.KOBOCAT_URL}/'
        )
        view_name = view.__name__

        if view_name in ['login', 'MfaLoginView'] and is_legacy_domain:
            return HttpResponseRedirect(koboform.login_url())

        return
