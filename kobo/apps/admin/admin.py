# coding: utf-8
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.urls import reverse
from django.utils.http import urlencode


class NoLoginAdminSite(admin.AdminSite):

    @never_cache
    def login(self, request, extra_context=None):
        """
        Display the login form for the given HttpRequest.
        """
        admin_url = reverse('admin:index', current_app=self.name)
        if request.method == 'GET' and self.has_permission(request):
            # Already logged-in, redirect to admin index
            return HttpResponseRedirect(admin_url)

        root_url = reverse('kobo_login', current_app=self.name)
        query_kwargs = {'next': admin_url}
        redirect_url = f'{root_url}?{urlencode(query_kwargs)}'
        return HttpResponseRedirect(redirect_url)
