# coding: utf-8
from django.contrib.auth.views import LoginView
from django.urls import reverse

from kpi.forms.mfa import (
    MFALoginForm,
    MFATokenForm,
)


class MFALoginView(LoginView):

    form_class = MFALoginForm

    def form_valid(self, form):
        if form.get_ephemeral_token():
            mfa_token_form = MFATokenForm(initial={
                'ephemeral_token': form.get_ephemeral_token()
            })
            context = self.get_context_data(
                view=MFATokenView, form=mfa_token_form
            )

            return self.response_class(
                request=self.request,
                template='registration/mfa_token.html',
                context=context,
                using=self.template_engine,
            )
        else:
            return super().form_valid(form)

    def get_redirect_url(self):
        """
        Overload parent method to validate `next` url
        """
        redirect_to = super().get_redirect_url()
        # We do not want to redirect a regular user to `/admin/` whether they
        # are not a superuser. Otherwise, they are successfully authenticated,
        # redirected to the admin platform, then disconnected because of the
        # lack of permissions.
        if (
            not redirect_to.startswith(reverse('admin:index'))
            or self.request.user.is_anonymous
        ):
            return redirect_to

        # If a regular (and authenticated) user tries to access the admin
        # platform, return an empty string. Every method that calls
        # `get_redirect_url()` will use `settings.LOGIN_REDIRECT_URL` instead.
        return redirect_to if self.request.user.is_superuser else ''


class MFATokenView(LoginView):

    """
    Display the login form and handle the login action.
    """
    form_class = MFATokenForm
    authentication_form = None
    template_name = 'registration/mfa_token.html'
    redirect_authenticated_user = False
    extra_context = None
